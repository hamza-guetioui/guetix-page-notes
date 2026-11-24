#!/bin/bash
# gif.sh <in.mp4> <start> <dur> <out.gif> [width]
W=${5:-960}
ffmpeg -loglevel error -y -ss $2 -t $3 -i "$1" -vf "fps=12,scale=$W:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle" -loop 0 "$4"
ls -la "$4" | awk '{print $5, $9}'
