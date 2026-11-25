/* Narration: TTS every line (cached), then compute segment durations + holds and build one voice track per video.
   node voice.mjs [id...]  → ../out/voice/<id>.json + <id>.m4a  */
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const VOICE = process.env.VOICE || "en-US-ChristopherNeural";
const ROOT = process.env.PNV_WORK || path.join(os.tmpdir(), "page-notes-videos");
const CACHE = `${ROOT}/tts/cache`;
const OUT = `${ROOT}/out/voice`;
fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
const NARR = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "narration.json"), "utf8"));
const LEAD = 350; // narration starts this long after a segment starts
const TAIL = 700; // room after a line before the next segment
const BASE = { title: 3400, install: 9000, privacy: 6000, outro: 6000 };

const dur = (f) => Math.round(parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString()) * 1000);

async function say(text) {
  const key = crypto.createHash("md5").update(VOICE + "|" + text).digest("hex").slice(0, 12);
  const file = `${CACHE}/${key}.mp3`;
  if (fs.existsSync(file) && fs.statSync(file).size > 1000) return file;
  for (let a = 0; a < 4; a++) {
    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      const dir = `${CACHE}/tmp-${key}`;
      fs.mkdirSync(dir, { recursive: true });
      const { audioFilePath } = await tts.toFile(dir, text, { rate: "-4%" });
      tts.close?.();
      if (fs.statSync(audioFilePath).size > 1000) {
        fs.renameSync(audioFilePath, file);
        fs.rmSync(dir, { recursive: true, force: true });
        return file;
      }
    } catch (e) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw new Error("TTS failed: " + text);
}

function chapterBase(id) {
  const t = JSON.parse(fs.readFileSync(`${ROOT}/rec/${id}/${id}.json`, "utf8"));
  const cuts = t.cuts || [];
  return t.chapters.map((c, i) => {
    const end = t.chapters[i + 1]?.t ?? t.duration;
    const cut = cuts.reduce((n, [a, b]) => (a >= c.t && a < end ? n + Math.min(b, end) - a : n), 0);
    return Math.max(500, end - c.t - cut);
  });
}

for (const id of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(NARR)) {
  const n = NARR[id];
  const base = chapterBase(id);
  if (base.length !== n.chapters.length) throw new Error(`${id}: ${base.length} chapters, ${n.chapters.length} lines`);
  const segs = []; // { kind, base, line }
  segs.push({ kind: "title", base: BASE.title, line: n.intro });
  (n.pre || []).forEach((l) => segs.push({ kind: "pre", base: BASE.install, line: l }));
  n.chapters.forEach((l, i) => segs.push({ kind: "chapter", i, base: base[i], line: l }));
  (n.post || []).forEach((l) => segs.push({ kind: "post", base: BASE.privacy, line: l }));
  segs.push({ kind: "outro", base: BASE.outro, line: n.outro });
  let t = 0;
  const parts = [];
  for (const s of segs) {
    const f = await say(s.line);
    const d = dur(f);
    s.dur = Math.max(s.base, LEAD + d + TAIL);
    s.hold = s.dur - s.base;
    parts.push({ f, at: t + LEAD, d });
    s.start = t;
    t += s.dur;
    process.stdout.write(".");
  }
  const total = t;
  // voice track: every line at its time
  const args = ["-y", "-loglevel", "error"];
  parts.forEach((p) => args.push("-i", p.f));
  const fc = parts.map((p, k) => `[${k}]aresample=48000,adelay=${p.at}|${p.at}[v${k}]`).join(";") + ";" + parts.map((_, k) => `[v${k}]`).join("") + `amix=inputs=${parts.length}:normalize=0,apad,atrim=0:${(total / 1000).toFixed(3)},loudnorm=I=-16:TP=-1.5:LRA=11[out]`;
  args.push("-filter_complex", fc, "-map", "[out]", "-ac", "1", "-c:a", "aac", "-b:a", "96k", `${OUT}/${id}.m4a`);
  execFileSync("ffmpeg", args);
  const meta = {
    voice: VOICE,
    total,
    title: segs.find((s) => s.kind === "title").dur,
    pre: segs.filter((s) => s.kind === "pre").map((s) => s.dur),
    holds: segs.filter((s) => s.kind === "chapter").map((s) => s.hold),
    post: segs.filter((s) => s.kind === "post").map((s) => s.dur),
    outro: segs.find((s) => s.kind === "outro").dur,
  };
  fs.writeFileSync(`${OUT}/${id}.json`, JSON.stringify(meta));
  console.log(`\n${id}: ${(total / 1000).toFixed(1)}s, holds ${meta.holds.map((h) => (h / 1000).toFixed(1)).join(" ")}`);
}
process.exit(0);
