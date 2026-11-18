/* Guetix Page Notes — UI translations for the popup + settings page.
 * Language = settings.lang ("auto" / unset → browser language, fallback English).
 * HTML: data-i18n (text), data-i18n-html (trusted markup from this file only), data-i18n-title, data-i18n-aria.
 *
 * Structure:
 * - D: dictionary { <lang code>: { <key>: string } }. English (en) is the full reference;
 *   missing keys fall back to English, then to the key itself. "{n}"-style placeholders are filled by t().
 * - LANGS: [code, native name] pairs shown in the pickers. RTL: right-to-left languages.
 * - Adds to the PN namespace from shared.js (must load first): PN.lang, PN.langPref, PN.LANGS,
 *   PN.t, PN.tn, PN.applyI18n, PN.initLang, PN.langPicker, PN.langMenu.
 * - The chosen language is saved in chrome.storage.local settings.lang; changing it reloads the page. */
/* eslint-disable no-var */
(function () {
  /** Translations: language code → { key: text }. */
  var D = {
    en: {
      showHere: "Show this page's notes", showHereD: "Only for the page you are on",
      urgent: "Urgent",
      secNotes: "Notes on pages", secToolbar: "Toolbar", secHelp: "Help & messages", secMore: "More", secDev: "Dev", devWarnL: "Read first", devWarn: "For developers. Turning on Inspect mode changes how the extension works: you only see and add element notes, and your normal notes are hidden until you turn it off. Not sure? Leave it off.", sWhen: "When notes appear", sWhenD: "Show notes right away, or only when you ask for them.", whenAuto: "Right away", whenAutoD: "As soon as a page opens", whenClick: "When I open Page Notes", whenClickD: "Click the toolbar icon to see them", sDock: "Toolbar on pages", sDockD: "The small bar in the corner to add and browse notes.", dockAuto: "When needed", dockAutoD: "Shows when a page has notes", dockMini: "Always, small", dockMiniD: "Always there as a tiny icon", dockOff: "Hidden", dockOffD: "Never shown - use shortcuts", sPos: "Toolbar position", sPosD: "Drag the toolbar by its logo to move it.", resetPos: "Reset position", posReset: "Toolbar back in the corner", gmFullD: "Opens while you place a note", gmCompactD: "Only a ? you can click",
      cEl: "Stick a note to an element", cHl: "Highlight text with a note",
      sGuideMode: "Guide style", sGuideModeD: "Full opens the guide while placing. Compact shows only a “?” you can click.", gmFull: "Full guide", gmCompact: "Compact (click ?)",
      showTips: "Show tips", showTipsD: "Guides and messages on web pages", sTips: "Show tips on pages", sTipsD: "Guides and short messages while you add notes. Turn off once you know your way around.", sGuide: "Show the placing guide", sGuideD: "The small card above the toolbar that explains how to place a note.", sUndo: "Show “Undo” after deleting", sUndoD: "A short bar that lets you bring a deleted note back.",
      markDone: "Mark as done", reopen: "Reopen",
      qAll: "All", qLinks: "Links", noMatch: "Nothing matches", noMatchX: "Try another filter.", siteEmpty: "No notes on this site yet", siteTip: "Notes from every page of {host}, newest first.", filters: "Quick filters",
      pageTip: "Notes pinned on the page you’re on.", recentTip: "Your latest notes from every site, newest first.", recentTipOn: "Latest notes on {host}, newest first.", only: "Only", clearFilt: "Show all sites",
      onPage: "On page", onEl: "On element", link1: "{n} link", linkN: "{n} links", showIt: "Show", openIt: "Open",
      viewAll: "View all",
      hint: "Press + New note, then click on the page.", lockS: "Open any website to add notes.",
      how: "How it works", tour: "1-min tour", sites: "Your sites", thisPage: "This page", thisSite: "This site", everywhere: "Everywhere", openAll: "Open all notes", recent: "Recent", allNotes: "All notes", newNote: "New note", tips: "Tips & colors", watch: "Watch tour",
      tip1: "<b>Select text</b> first to highlight it, or click anywhere.", tip2: "<b>Drag</b> the dock’s + NOTE anywhere on the page.", tip3: "Hold <b>Shift</b> to stick a note to an element.",
      open: "Open", done: "Done", hl: "Highlight", el: "Element", link: "Link", free: "Free", show: "Show notes", settings: "Settings", lang: "Language", auto: "Auto", note: "Note",
      focusNote: "Show this note on the page", openOn: "Open {host} on this note", curSite: "Current site", everySite: "Every site", allSites: "All sites", sitesEmpty: "Your sites appear here once you pin a note.", site1: "{n} site", siteN: "{n} sites",
      showRecentOn: "Show recent notes on {host}", showRecent: "Show recent notes", showPage: "Show this page’s notes", openAllMine: "Open all my notes", none: "No notes yet", na: "Not available here", pick: "Pick a site", nOpen: "{n} open", nDone: "{n} done",
      onPage1: "on {n} page", onPageN: "on {n} pages", across1: "across {n} site", acrossN: "across {n} sites", start: "Start pinning",
      firstT: "Your first note is one click away", firstX: "Pin a sticky note anywhere on a website — it’s still there when you come back.", addFirst: "Add first note", kNew: "new note", kSel: "Select text", kHl: "highlight",
      lockT: "Notes can’t live here", lockX: "Browser and store pages are protected. Open any website to pin notes.", cleanT: "This page is clean", cleanX: "No notes on {host} yet. Add one, then click anywhere — or select text first to highlight it.", addHere: "Add a note here", seeRecent: "See recent ({n})", more: "+ {n} more in All notes", thisTab: "This tab", empty: "(empty note)",
      back: "All notes", onPages: "On pages", sVis: "Show notes on pages", sVisD: "Hide every note at once without deleting anything. Same as Alt+Shift+H.", sAutoMin: "Minimize notes after writing", sAutoMinD: "When you click outside a note that has text, it folds into a tab.", sFold: "Fold the + NOTE dock", sFoldD: "Shrink the floating dock to just its logo. Click the logo to unfold it.", sSnap: "Save page snapshots", sPanel: "Open in side panel", sPanelD: "Clicking the toolbar icon opens a resizable side panel instead of the dropdown.", sSnapD: "Store a small screenshot with each note so the list is easy to scan.", sDev: "Inspect mode", sDevD: "Element notes only, kept apart from your normal notes. Copy as text lists every page of the site with the CSS path of each element.", sLangD: "Auto follows your browser language.",
      keys: "Keyboard shortcuts", changeKeys: "Change shortcuts", data: "Your data", notes: "Notes", pages: "Pages", sitesW: "Sites", storage: "Storage", dataX: "Everything is stored on this device only — no account, no server. Export a backup before switching browsers.",
      export: "Export backup (.json)", import: "Import", clearShots: "Clear snapshots", wipe: "Delete everything", about: "About", madeBy: "Made by Hamza Guetioui", saved: "Saved", notSet: "Not set",
      cPlace: "New note (or highlight the selected text)", cToggle: "Show / hide notes on pages", cPopup: "Open this popup", exported: "Backup exported", imported: "Imported {n} new notes", badJson: "That file isn’t valid JSON.", noPages: "No pages found in this file.",
      noShots: "No snapshots to clear", confShots: "Remove all {n} snapshots? Your notes stay.", shotsCleared: "Snapshots cleared", nothing: "Nothing to delete", confWipe: "Delete ALL your page notes and snapshots? Export first if you want a backup. This can’t be undone.", wiped: "Everything deleted",
    },
    fr: {
      showHere: "Afficher les notes de cette page", showHereD: "Uniquement pour la page actuelle",
      urgent: "Urgent",
      secNotes: "Notes sur les pages", secToolbar: "Barre d’outils", secHelp: "Aide & messages", secMore: "Plus", secDev: "Dev", devWarnL: "À lire", devWarn: "Pour les développeurs. Activer le mode Inspection change le fonctionnement de l'extension : vous ne voyez et n'ajoutez que des notes sur éléments, et vos notes normales sont masquées jusqu'à sa désactivation. Pas sûr ? Laissez-le désactivé.", sWhen: "Quand afficher les notes", sWhenD: "Afficher les notes tout de suite, ou seulement quand vous le demandez.", whenAuto: "Tout de suite", whenAutoD: "Dès que la page s’ouvre", whenClick: "Quand j’ouvre Page Notes", whenClickD: "Cliquez sur l’icône pour les voir", sDock: "Barre sur les pages", sDockD: "La petite barre dans le coin pour ajouter et parcourir les notes.", dockAuto: "Si besoin", dockAutoD: "Visible quand la page a des notes", dockMini: "Toujours, réduite", dockMiniD: "Toujours là, en petite icône", dockOff: "Masquée", dockOffD: "Jamais affichée - utilisez les raccourcis", sPos: "Position de la barre", sPosD: "Faites glisser la barre par son logo pour la déplacer.", resetPos: "Réinitialiser", posReset: "Barre remise dans le coin", gmFullD: "S’ouvre pendant le placement", gmCompactD: "Seulement un ? cliquable",
      cEl: "Fixer une note à un élément", cHl: "Surligner du texte avec une note",
      sGuideMode: "Style du guide", sGuideModeD: "Complet ouvre le guide pendant le placement. Compact affiche seulement un « ? » cliquable.", gmFull: "Guide complet", gmCompact: "Compact (clic sur ?)",
      showTips: "Afficher les astuces", showTipsD: "Guides et messages sur les pages", sTips: "Afficher les astuces sur les pages", sTipsD: "Guides et petits messages quand vous ajoutez des notes. Désactivez quand vous êtes à l’aise.", sGuide: "Afficher le guide de placement", sGuideD: "La barre en haut qui explique comment placer une note.", sUndo: "Afficher « Annuler » après suppression", sUndoD: "Une petite barre pour récupérer une note supprimée.",
      markDone: "Marquer comme terminée", reopen: "Rouvrir",
      qAll: "Toutes", qLinks: "Liens", noMatch: "Aucun résultat", noMatchX: "Essayez un autre filtre.", siteEmpty: "Aucune note sur ce site", siteTip: "Notes de toutes les pages de {host}, les plus récentes d’abord.", filters: "Filtres rapides",
      pageTip: "Les notes épinglées sur la page actuelle.", recentTip: "Vos dernières notes de tous les sites, les plus récentes d’abord.", recentTipOn: "Dernières notes sur {host}, les plus récentes d’abord.", only: "Seulement", clearFilt: "Afficher tous les sites",
      onPage: "Sur la page", onEl: "Sur un élément", link1: "{n} lien", linkN: "{n} liens", showIt: "Voir", openIt: "Ouvrir",
      viewAll: "Tout voir",
      hint: "Cliquez sur + Nouvelle note, puis sur la page.", lockS: "Ouvrez un site web pour ajouter des notes.",
      how: "Comment ça marche", tour: "Visite d’1 min", sites: "Vos sites", thisPage: "Cette page", thisSite: "Ce site", everywhere: "Partout", openAll: "Ouvrir toutes les notes", recent: "Récentes", allNotes: "Toutes les notes", newNote: "Nouvelle note", tips: "Astuces & couleurs", watch: "Voir la visite",
      tip1: "<b>Sélectionnez du texte</b> pour le surligner, ou cliquez n’importe où.", tip2: "<b>Glissez</b> le + NOTE du dock n’importe où sur la page.", tip3: "Maintenez <b>Maj</b> pour fixer une note à un élément.",
      open: "Ouverte", done: "Terminée", hl: "Surlignage", el: "Élément", link: "Lien", free: "Libre", show: "Afficher les notes", settings: "Paramètres", lang: "Langue", auto: "Auto", note: "Note",
      focusNote: "Afficher cette note sur la page", openOn: "Ouvrir {host} sur cette note", curSite: "Site actuel", everySite: "Tous les sites", allSites: "Tous les sites", sitesEmpty: "Vos sites apparaîtront ici dès votre première note.", site1: "{n} site", siteN: "{n} sites",
      showRecentOn: "Notes récentes sur {host}", showRecent: "Notes récentes", showPage: "Notes de cette page", openAllMine: "Ouvrir toutes mes notes", none: "Aucune note", na: "Indisponible ici", pick: "Choisissez un site", nOpen: "{n} ouverte(s)", nDone: "{n} terminée(s)",
      onPage1: "sur {n} page", onPageN: "sur {n} pages", across1: "sur {n} site", acrossN: "sur {n} sites", start: "Commencez à épingler",
      firstT: "Votre première note est à un clic", firstX: "Épinglez une note n’importe où sur un site — elle sera toujours là à votre retour.", addFirst: "Ajouter une note", kNew: "nouvelle note", kSel: "Sélection", kHl: "surligner",
      lockT: "Pas de notes ici", lockX: "Les pages du navigateur et des stores sont protégées. Ouvrez un site web pour épingler des notes.", cleanT: "Cette page est vide", cleanX: "Aucune note sur {host}. Ajoutez-en une puis cliquez n’importe où — ou sélectionnez du texte pour le surligner.", addHere: "Ajouter une note ici", seeRecent: "Voir les récentes ({n})", more: "+ {n} de plus dans Toutes les notes", thisTab: "Cet onglet", empty: "(note vide)",
      back: "Toutes les notes", onPages: "Sur les pages", sVis: "Afficher les notes sur les pages", sVisD: "Masquez toutes les notes d’un coup sans rien supprimer. Comme Alt+Maj+H.", sAutoMin: "Réduire les notes après écriture", sAutoMinD: "Quand vous cliquez hors d'une note remplie, elle se replie en onglet.", sFold: "Replier le dock + NOTE", sFoldD: "Réduit le dock flottant à son logo. Cliquez sur le logo pour le déplier.", sSnap: "Enregistrer des captures", sPanel: "Ouvrir dans le panneau latéral", sPanelD: "Le clic sur l’icône ouvre un panneau latéral redimensionnable au lieu du menu.", sSnapD: "Garde une petite capture avec chaque note pour parcourir la liste facilement.", sDev: "Mode inspection", sDevD: "Notes sur éléments uniquement, séparées de vos notes normales. Copier en texte liste chaque page du site avec le chemin CSS de chaque élément.", sLangD: "Auto suit la langue de votre navigateur.",
      keys: "Raccourcis clavier", changeKeys: "Modifier les raccourcis", data: "Vos données", notes: "Notes", pages: "Pages", sitesW: "Sites", storage: "Stockage", dataX: "Tout est stocké sur cet appareil uniquement — sans compte ni serveur. Exportez une sauvegarde avant de changer de navigateur.",
      export: "Exporter (.json)", import: "Importer", clearShots: "Effacer les captures", wipe: "Tout supprimer", about: "À propos", madeBy: "Créé par Hamza Guetioui", saved: "Enregistré", notSet: "Non défini",
      cPlace: "Nouvelle note (ou surligner le texte sélectionné)", cToggle: "Afficher / masquer les notes", cPopup: "Ouvrir cette fenêtre", exported: "Sauvegarde exportée", imported: "{n} nouvelle(s) note(s) importée(s)", badJson: "Ce fichier n’est pas un JSON valide.", noPages: "Aucune page trouvée dans ce fichier.",
      noShots: "Aucune capture à effacer", confShots: "Supprimer les {n} captures ? Vos notes restent.", shotsCleared: "Captures effacées", nothing: "Rien à supprimer", confWipe: "Supprimer TOUTES vos notes et captures ? Exportez d’abord si vous voulez une sauvegarde. Action irréversible.", wiped: "Tout a été supprimé",
    },
    es: {
      showHere: "Mostrar notas de esta página", showHereD: "Solo para la página actual",
      urgent: "Urgente",
      secNotes: "Notas en las páginas", secToolbar: "Barra", secHelp: "Ayuda y mensajes", secMore: "Más", secDev: "Dev", devWarnL: "Leer antes", devWarn: "Para desarrolladores. Activar el modo Inspección cambia cómo funciona la extensión: solo verás y añadirás notas de elementos, y tus notas normales quedan ocultas hasta que lo desactives. ¿No estás seguro? Déjalo desactivado.", sWhen: "Cuándo mostrar las notas", sWhenD: "Muestra las notas al momento o solo cuando las pidas.", whenAuto: "Al momento", whenAutoD: "En cuanto se abre la página", whenClick: "Al abrir Page Notes", whenClickD: "Haz clic en el icono para verlas", sDock: "Barra en las páginas", sDockD: "La pequeña barra de la esquina para añadir y ver notas.", dockAuto: "Cuando haga falta", dockAutoD: "Aparece si la página tiene notas", dockMini: "Siempre, pequeña", dockMiniD: "Siempre como un icono pequeño", dockOff: "Oculta", dockOffD: "Nunca se muestra - usa atajos", sPos: "Posición de la barra", sPosD: "Arrastra la barra por su logo para moverla.", resetPos: "Restablecer", posReset: "Barra de vuelta en la esquina", gmFullD: "Se abre al colocar una nota", gmCompactD: "Solo un ? para pulsar",
      cEl: "Fijar una nota a un elemento", cHl: "Resaltar texto con una nota",
      sGuideMode: "Estilo de la guía", sGuideModeD: "Completa abre la guía al colocar. Compacta muestra solo un «?» que puedes pulsar.", gmFull: "Guía completa", gmCompact: "Compacta (clic en ?)",
      showTips: "Mostrar consejos", showTipsD: "Guías y mensajes en las páginas", sTips: "Mostrar consejos en las páginas", sTipsD: "Guías y mensajes breves al añadir notas. Desactívalo cuando ya lo domines.", sGuide: "Mostrar la guía de colocación", sGuideD: "La barra superior que explica cómo colocar una nota.", sUndo: "Mostrar «Deshacer» al borrar", sUndoD: "Una barra breve para recuperar una nota borrada.",
      markDone: "Marcar como hecha", reopen: "Reabrir",
      qAll: "Todas", qLinks: "Enlaces", noMatch: "Sin resultados", noMatchX: "Prueba otro filtro.", siteEmpty: "Aún no hay notas en este sitio", siteTip: "Notas de todas las páginas de {host}, las más nuevas primero.", filters: "Filtros rápidos",
      pageTip: "Notas fijadas en la página actual.", recentTip: "Tus últimas notas de todos los sitios, las más nuevas primero.", recentTipOn: "Últimas notas en {host}, las más nuevas primero.", only: "Solo", clearFilt: "Mostrar todos los sitios",
      onPage: "En la página", onEl: "En un elemento", link1: "{n} enlace", linkN: "{n} enlaces", showIt: "Ver", openIt: "Abrir",
      viewAll: "Ver todo",
      hint: "Pulsa + Nueva nota y haz clic en la página.", lockS: "Abre cualquier web para añadir notas.",
      how: "Cómo funciona", tour: "Tour de 1 min", sites: "Tus sitios", thisPage: "Esta página", thisSite: "Este sitio", everywhere: "En todas partes", openAll: "Abrir todas las notas", recent: "Recientes", allNotes: "Todas las notas", newNote: "Nueva nota", tips: "Consejos y colores", watch: "Ver tour",
      tip1: "<b>Selecciona texto</b> para resaltarlo, o haz clic en cualquier lugar.", tip2: "<b>Arrastra</b> el + NOTE del dock a cualquier parte de la página.", tip3: "Mantén <b>Shift</b> para fijar una nota a un elemento.",
      open: "Abierta", done: "Hecha", hl: "Resaltado", el: "Elemento", link: "Enlace", free: "Libre", show: "Mostrar notas", settings: "Ajustes", lang: "Idioma", auto: "Auto", note: "Nota",
      focusNote: "Mostrar esta nota en la página", openOn: "Abrir {host} en esta nota", curSite: "Sitio actual", everySite: "Todos los sitios", allSites: "Todos los sitios", sitesEmpty: "Tus sitios aparecerán aquí cuando fijes una nota.", site1: "{n} sitio", siteN: "{n} sitios",
      showRecentOn: "Notas recientes en {host}", showRecent: "Notas recientes", showPage: "Notas de esta página", openAllMine: "Abrir todas mis notas", none: "Sin notas aún", na: "No disponible aquí", pick: "Elige un sitio", nOpen: "{n} abiertas", nDone: "{n} hechas",
      onPage1: "en {n} página", onPageN: "en {n} páginas", across1: "en {n} sitio", acrossN: "en {n} sitios", start: "Empieza a fijar",
      firstT: "Tu primera nota está a un clic", firstX: "Fija una nota en cualquier web — seguirá ahí cuando vuelvas.", addFirst: "Añadir primera nota", kNew: "nueva nota", kSel: "Seleccionar", kHl: "resaltar",
      lockT: "Aquí no hay notas", lockX: "Las páginas del navegador y de las tiendas están protegidas. Abre cualquier web para fijar notas.", cleanT: "Esta página está limpia", cleanX: "Aún no hay notas en {host}. Añade una y haz clic donde quieras — o selecciona texto para resaltarlo.", addHere: "Añadir nota aquí", seeRecent: "Ver recientes ({n})", more: "+ {n} más en Todas las notas", thisTab: "Esta pestaña", empty: "(nota vacía)",
      back: "Todas las notas", onPages: "En las páginas", sVis: "Mostrar notas en las páginas", sVisD: "Oculta todas las notas a la vez sin borrar nada. Igual que Alt+Shift+H.", sAutoMin: "Minimizar notas al escribir", sAutoMinD: "Al hacer clic fuera de una nota con texto, se pliega en una pestaña.", sFold: "Plegar el dock + NOTE", sFoldD: "Reduce el dock flotante a su logo. Haz clic en el logo para desplegarlo.", sSnap: "Guardar capturas", sPanel: "Abrir en panel lateral", sPanelD: "Al pulsar el icono se abre un panel lateral redimensionable en lugar del menú.", sSnapD: "Guarda una pequeña captura con cada nota para revisar la lista fácilmente.", sLangD: "Auto sigue el idioma de tu navegador.",
      keys: "Atajos de teclado", changeKeys: "Cambiar atajos", data: "Tus datos", notes: "Notas", pages: "Páginas", sitesW: "Sitios", storage: "Almacenamiento", dataX: "Todo se guarda solo en este dispositivo — sin cuenta ni servidor. Exporta una copia antes de cambiar de navegador.",
      export: "Exportar copia (.json)", import: "Importar", clearShots: "Borrar capturas", wipe: "Borrar todo", about: "Acerca de", madeBy: "Hecho por Hamza Guetioui", saved: "Guardado", notSet: "Sin asignar",
      cPlace: "Nueva nota (o resaltar el texto seleccionado)", cToggle: "Mostrar / ocultar notas", cPopup: "Abrir esta ventana", exported: "Copia exportada", imported: "{n} notas nuevas importadas", badJson: "Ese archivo no es un JSON válido.", noPages: "No se encontraron páginas en este archivo.",
      noShots: "No hay capturas que borrar", confShots: "¿Eliminar las {n} capturas? Tus notas se quedan.", shotsCleared: "Capturas borradas", nothing: "Nada que borrar", confWipe: "¿Borrar TODAS tus notas y capturas? Exporta antes si quieres una copia. No se puede deshacer.", wiped: "Todo borrado",
    },
    de: {
      showHere: "Notizen dieser Seite zeigen", showHereD: "Nur für die aktuelle Seite",
      urgent: "Dringend",
      secNotes: "Notizen auf Seiten", secToolbar: "Leiste", secHelp: "Hilfe & Meldungen", secMore: "Mehr", secDev: "Dev", devWarnL: "Zuerst lesen", devWarn: "Für Entwickler. Der Inspektionsmodus ändert, wie die Erweiterung funktioniert: Du siehst und erstellst nur Element-Notizen, deine normalen Notizen sind ausgeblendet, bis du ihn ausschaltest. Unsicher? Lass ihn aus.", sWhen: "Wann Notizen erscheinen", sWhenD: "Notizen sofort zeigen oder nur, wenn du sie aufrufst.", whenAuto: "Sofort", whenAutoD: "Sobald die Seite lädt", whenClick: "Wenn ich Page Notes öffne", whenClickD: "Klick aufs Symbol zeigt sie", sDock: "Leiste auf Seiten", sDockD: "Die kleine Leiste in der Ecke zum Hinzufügen und Durchblättern.", dockAuto: "Bei Bedarf", dockAutoD: "Erscheint, wenn die Seite Notizen hat", dockMini: "Immer, klein", dockMiniD: "Immer als kleines Symbol", dockOff: "Aus", dockOffD: "Nie sichtbar - nutze Kürzel", sPos: "Position der Leiste", sPosD: "Zieh die Leiste am Logo, um sie zu verschieben.", resetPos: "Zurücksetzen", posReset: "Leiste wieder in der Ecke", gmFullD: "Öffnet sich beim Platzieren", gmCompactD: "Nur ein ? zum Anklicken",
      cEl: "Notiz an ein Element heften", cHl: "Text mit Notiz hervorheben",
      sGuideMode: "Hinweis-Stil", sGuideModeD: "Voll öffnet den Hinweis beim Platzieren. Kompakt zeigt nur ein „?“ zum Anklicken.", gmFull: "Voller Hinweis", gmCompact: "Kompakt (auf ? klicken)",
      showTips: "Tipps zeigen", showTipsD: "Hinweise und Meldungen auf Webseiten", sTips: "Tipps auf Seiten zeigen", sTipsD: "Hinweise und kurze Meldungen beim Anlegen von Notizen. Ausschalten, wenn du dich auskennst.", sGuide: "Platzierungs-Hinweis zeigen", sGuideD: "Die Leiste oben, die erklärt, wie man eine Notiz platziert.", sUndo: "„Rückgängig“ nach dem Löschen zeigen", sUndoD: "Eine kurze Leiste, um eine gelöschte Notiz zurückzuholen.",
      markDone: "Als erledigt markieren", reopen: "Wieder öffnen",
      qAll: "Alle", qLinks: "Links", noMatch: "Keine Treffer", noMatchX: "Probier einen anderen Filter.", siteEmpty: "Noch keine Notizen auf dieser Website", siteTip: "Notizen von allen Seiten von {host}, neueste zuerst.", filters: "Schnellfilter",
      pageTip: "Notizen auf der aktuellen Seite.", recentTip: "Deine neuesten Notizen von allen Websites, neueste zuerst.", recentTipOn: "Neueste Notizen auf {host}, neueste zuerst.", only: "Nur", clearFilt: "Alle Websites zeigen",
      onPage: "Auf der Seite", onEl: "An Element", link1: "{n} Link", linkN: "{n} Links", showIt: "Zeigen", openIt: "Öffnen",
      viewAll: "Alle ansehen",
      hint: "Klicke auf + Neue Notiz, dann auf die Seite.", lockS: "Öffne eine Website, um Notizen anzulegen.",
      how: "So funktioniert’s", tour: "1-Min-Tour", sites: "Deine Seiten", thisPage: "Diese Seite", thisSite: "Diese Website", everywhere: "Überall", openAll: "Alle Notizen öffnen", recent: "Neueste", allNotes: "Alle Notizen", newNote: "Neue Notiz", tips: "Tipps & Farben", watch: "Tour ansehen",
      tip1: "<b>Text markieren</b>, um ihn hervorzuheben, oder irgendwo klicken.", tip2: "<b>Ziehe</b> das + NOTE des Docks an jede Stelle der Seite.", tip3: "Halte <b>Shift</b>, um eine Notiz an ein Element zu heften.",
      open: "Offen", done: "Erledigt", hl: "Markierung", el: "Element", link: "Link", free: "Frei", show: "Notizen zeigen", settings: "Einstellungen", lang: "Sprache", auto: "Auto", note: "Notiz",
      focusNote: "Diese Notiz auf der Seite zeigen", openOn: "{host} bei dieser Notiz öffnen", curSite: "Aktuelle Website", everySite: "Alle Websites", allSites: "Alle Websites", sitesEmpty: "Deine Websites erscheinen hier, sobald du eine Notiz anheftest.", site1: "{n} Website", siteN: "{n} Websites",
      showRecentOn: "Neueste Notizen auf {host}", showRecent: "Neueste Notizen", showPage: "Notizen dieser Seite", openAllMine: "Alle meine Notizen öffnen", none: "Noch keine Notizen", na: "Hier nicht verfügbar", pick: "Website wählen", nOpen: "{n} offen", nDone: "{n} erledigt",
      onPage1: "auf {n} Seite", onPageN: "auf {n} Seiten", across1: "auf {n} Website", acrossN: "auf {n} Websites", start: "Leg los",
      firstT: "Deine erste Notiz ist einen Klick entfernt", firstX: "Hefte eine Notiz irgendwo auf eine Website — sie ist noch da, wenn du zurückkommst.", addFirst: "Erste Notiz anlegen", kNew: "neue Notiz", kSel: "Text markieren", kHl: "hervorheben",
      lockT: "Hier gehen keine Notizen", lockX: "Browser- und Store-Seiten sind geschützt. Öffne eine beliebige Website, um Notizen anzuheften.", cleanT: "Diese Seite ist leer", cleanX: "Noch keine Notizen auf {host}. Leg eine an und klicke irgendwo — oder markiere zuerst Text.", addHere: "Notiz hier anlegen", seeRecent: "Neueste ansehen ({n})", more: "+ {n} weitere unter Alle Notizen", thisTab: "Dieser Tab", empty: "(leere Notiz)",
      back: "Alle Notizen", onPages: "Auf Seiten", sVis: "Notizen auf Seiten zeigen", sVisD: "Blende alle Notizen auf einmal aus, ohne etwas zu löschen. Wie Alt+Shift+H.", sAutoMin: "Notizen nach dem Schreiben minimieren", sAutoMinD: "Klickst du außerhalb einer Notiz mit Text, wird sie zu einem Tab eingeklappt.", sFold: "+ NOTE-Dock einklappen", sFoldD: "Verkleinert das schwebende Dock auf sein Logo. Klick aufs Logo klappt es aus.", sSnap: "Seiten-Screenshots speichern", sPanel: "In der Seitenleiste öffnen", sPanelD: "Ein Klick auf das Symbol öffnet eine anpassbare Seitenleiste statt des Menüs.", sSnapD: "Speichert einen kleinen Screenshot pro Notiz, damit die Liste leicht zu überblicken ist.", sLangD: "Auto folgt der Sprache deines Browsers.",
      keys: "Tastenkürzel", changeKeys: "Kürzel ändern", data: "Deine Daten", notes: "Notizen", pages: "Seiten", sitesW: "Websites", storage: "Speicher", dataX: "Alles bleibt nur auf diesem Gerät — kein Konto, kein Server. Exportiere ein Backup, bevor du den Browser wechselst.",
      export: "Backup exportieren (.json)", import: "Importieren", clearShots: "Screenshots löschen", wipe: "Alles löschen", about: "Über", madeBy: "Von Hamza Guetioui", saved: "Gespeichert", notSet: "Nicht festgelegt",
      cPlace: "Neue Notiz (oder markierten Text hervorheben)", cToggle: "Notizen zeigen / ausblenden", cPopup: "Dieses Popup öffnen", exported: "Backup exportiert", imported: "{n} neue Notizen importiert", badJson: "Diese Datei ist kein gültiges JSON.", noPages: "Keine Seiten in dieser Datei gefunden.",
      noShots: "Keine Screenshots zu löschen", confShots: "Alle {n} Screenshots entfernen? Deine Notizen bleiben.", shotsCleared: "Screenshots gelöscht", nothing: "Nichts zu löschen", confWipe: "ALLE Notizen und Screenshots löschen? Exportiere vorher ein Backup. Das kann nicht rückgängig gemacht werden.", wiped: "Alles gelöscht",
    },
    pt: {
      showHere: "Mostrar notas desta página", showHereD: "Só para a página atual",
      urgent: "Urgente",
      secNotes: "Notas nas páginas", secToolbar: "Barra", secHelp: "Ajuda e mensagens", secMore: "Mais", secDev: "Dev", devWarnL: "Leia antes", devWarn: "Para desenvolvedores. Ativar o modo Inspeção muda o funcionamento da extensão: você só vê e adiciona notas de elementos, e suas notas normais ficam ocultas até desativá-lo. Na dúvida? Deixe desativado.", sWhen: "Quando mostrar as notas", sWhenD: "Mostre as notas na hora ou só quando pedir.", whenAuto: "Na hora", whenAutoD: "Assim que a página abre", whenClick: "Quando abro o Page Notes", whenClickD: "Clique no ícone para vê-las", sDock: "Barra nas páginas", sDockD: "A pequena barra no canto para adicionar e ver notas.", dockAuto: "Quando precisar", dockAutoD: "Aparece se a página tem notas", dockMini: "Sempre, pequena", dockMiniD: "Sempre como um ícone pequeno", dockOff: "Oculta", dockOffD: "Nunca aparece - use atalhos", sPos: "Posição da barra", sPosD: "Arraste a barra pelo logo para movê-la.", resetPos: "Redefinir", posReset: "Barra de volta ao canto", gmFullD: "Abre ao posicionar uma nota", gmCompactD: "Só um ? para clicar",
      cEl: "Prender nota a um elemento", cHl: "Destacar texto com uma nota",
      sGuideMode: "Estilo do guia", sGuideModeD: "Completo abre o guia ao posicionar. Compacto mostra só um “?” para clicar.", gmFull: "Guia completo", gmCompact: "Compacto (clique em ?)",
      showTips: "Mostrar dicas", showTipsD: "Guias e mensagens nas páginas", sTips: "Mostrar dicas nas páginas", sTipsD: "Guias e mensagens curtas ao adicionar notas. Desative quando já souber usar.", sGuide: "Mostrar o guia de posicionamento", sGuideD: "A barra no topo que explica como colocar uma nota.", sUndo: "Mostrar “Desfazer” ao apagar", sUndoD: "Uma barra curta para recuperar uma nota apagada.",
      markDone: "Marcar como concluída", reopen: "Reabrir",
      qAll: "Todas", qLinks: "Links", noMatch: "Nada encontrado", noMatchX: "Tente outro filtro.", siteEmpty: "Nenhuma nota neste site ainda", siteTip: "Notas de todas as páginas de {host}, das mais novas primeiro.", filters: "Filtros rápidos",
      pageTip: "Notas fixadas na página atual.", recentTip: "Suas notas mais recentes de todos os sites, das mais novas primeiro.", recentTipOn: "Notas recentes em {host}, das mais novas primeiro.", only: "Só", clearFilt: "Mostrar todos os sites",
      onPage: "Na página", onEl: "No elemento", link1: "{n} link", linkN: "{n} links", showIt: "Ver", openIt: "Abrir",
      viewAll: "Ver tudo",
      hint: "Clique em + Nova nota e depois na página.", lockS: "Abra qualquer site para adicionar notas.",
      how: "Como funciona", tour: "Tour de 1 min", sites: "Seus sites", thisPage: "Esta página", thisSite: "Este site", everywhere: "Em todo lugar", openAll: "Abrir todas as notas", recent: "Recentes", allNotes: "Todas as notas", newNote: "Nova nota", tips: "Dicas e cores", watch: "Ver tour",
      tip1: "<b>Selecione texto</b> para destacá-lo, ou clique em qualquer lugar.", tip2: "<b>Arraste</b> o + NOTE do dock para qualquer lugar da página.", tip3: "Segure <b>Shift</b> para prender uma nota a um elemento.",
      open: "Aberta", done: "Concluída", hl: "Destaque", el: "Elemento", link: "Link", free: "Livre", show: "Mostrar notas", settings: "Configurações", lang: "Idioma", auto: "Auto", note: "Nota",
      focusNote: "Mostrar esta nota na página", openOn: "Abrir {host} nesta nota", curSite: "Site atual", everySite: "Todos os sites", allSites: "Todos os sites", sitesEmpty: "Seus sites aparecem aqui quando você fixar uma nota.", site1: "{n} site", siteN: "{n} sites",
      showRecentOn: "Notas recentes em {host}", showRecent: "Notas recentes", showPage: "Notas desta página", openAllMine: "Abrir todas as minhas notas", none: "Nenhuma nota ainda", na: "Indisponível aqui", pick: "Escolha um site", nOpen: "{n} abertas", nDone: "{n} concluídas",
      onPage1: "em {n} página", onPageN: "em {n} páginas", across1: "em {n} site", acrossN: "em {n} sites", start: "Comece a fixar",
      firstT: "Sua primeira nota está a um clique", firstX: "Fixe uma nota em qualquer site — ela continua lá quando você voltar.", addFirst: "Adicionar primeira nota", kNew: "nova nota", kSel: "Selecionar", kHl: "destacar",
      lockT: "Notas não funcionam aqui", lockX: "Páginas do navegador e das lojas são protegidas. Abra qualquer site para fixar notas.", cleanT: "Esta página está limpa", cleanX: "Nenhuma nota em {host} ainda. Adicione uma e clique em qualquer lugar — ou selecione texto para destacá-lo.", addHere: "Adicionar nota aqui", seeRecent: "Ver recentes ({n})", more: "+ {n} em Todas as notas", thisTab: "Esta aba", empty: "(nota vazia)",
      back: "Todas as notas", onPages: "Nas páginas", sVis: "Mostrar notas nas páginas", sVisD: "Oculte todas as notas de uma vez sem apagar nada. Igual a Alt+Shift+H.", sAutoMin: "Minimizar notas após escrever", sAutoMinD: "Ao clicar fora de uma nota com texto, ela vira uma aba.", sFold: "Recolher o dock + NOTE", sFoldD: "Reduz o dock flutuante ao logo. Clique no logo para expandir.", sSnap: "Salvar capturas", sPanel: "Abrir no painel lateral", sPanelD: "Clicar no ícone abre um painel lateral redimensionável em vez do menu.", sSnapD: "Guarda uma pequena captura com cada nota para facilitar a lista.", sLangD: "Auto segue o idioma do navegador.",
      keys: "Atalhos de teclado", changeKeys: "Alterar atalhos", data: "Seus dados", notes: "Notas", pages: "Páginas", sitesW: "Sites", storage: "Armazenamento", dataX: "Tudo fica só neste dispositivo — sem conta, sem servidor. Exporte um backup antes de trocar de navegador.",
      export: "Exportar backup (.json)", import: "Importar", clearShots: "Limpar capturas", wipe: "Apagar tudo", about: "Sobre", madeBy: "Feito por Hamza Guetioui", saved: "Salvo", notSet: "Não definido",
      cPlace: "Nova nota (ou destacar o texto selecionado)", cToggle: "Mostrar / ocultar notas", cPopup: "Abrir este popup", exported: "Backup exportado", imported: "{n} notas novas importadas", badJson: "Esse arquivo não é um JSON válido.", noPages: "Nenhuma página encontrada neste arquivo.",
      noShots: "Nenhuma captura para limpar", confShots: "Remover as {n} capturas? Suas notas ficam.", shotsCleared: "Capturas removidas", nothing: "Nada para apagar", confWipe: "Apagar TODAS as notas e capturas? Exporte antes se quiser um backup. Não dá para desfazer.", wiped: "Tudo apagado",
    },
    it: {
      showHere: "Mostra le note di questa pagina", showHereD: "Solo per la pagina attuale",
      urgent: "Urgente",
      secNotes: "Note sulle pagine", secToolbar: "Barra", secHelp: "Aiuto e messaggi", secMore: "Altro", secDev: "Dev", devWarnL: "Leggi prima", devWarn: "Per sviluppatori. Attivare la modalità Ispezione cambia il funzionamento dell'estensione: vedi e aggiungi solo note sugli elementi, e le tue note normali restano nascoste finché non la disattivi. Non sei sicuro? Lasciala disattivata.", sWhen: "Quando mostrare le note", sWhenD: "Mostra le note subito o solo quando le chiedi.", whenAuto: "Subito", whenAutoD: "Appena si apre la pagina", whenClick: "Quando apro Page Notes", whenClickD: "Clicca l’icona per vederle", sDock: "Barra sulle pagine", sDockD: "La piccola barra nell’angolo per aggiungere e sfogliare le note.", dockAuto: "Quando serve", dockAutoD: "Appare se la pagina ha note", dockMini: "Sempre, piccola", dockMiniD: "Sempre come piccola icona", dockOff: "Nascosta", dockOffD: "Mai visibile - usa le scorciatoie", sPos: "Posizione della barra", sPosD: "Trascina la barra dal logo per spostarla.", resetPos: "Ripristina", posReset: "Barra di nuovo nell’angolo", gmFullD: "Si apre mentre posizioni", gmCompactD: "Solo un ? da cliccare",
      cEl: "Fissa una nota a un elemento", cHl: "Evidenzia testo con una nota",
      sGuideMode: "Stile della guida", sGuideModeD: "Completa apre la guida mentre posizioni. Compatta mostra solo un “?” da cliccare.", gmFull: "Guida completa", gmCompact: "Compatta (clic su ?)",
      showTips: "Mostra suggerimenti", showTipsD: "Guide e messaggi sulle pagine", sTips: "Mostra suggerimenti sulle pagine", sTipsD: "Guide e brevi messaggi mentre aggiungi note. Disattiva quando ti senti pratico.", sGuide: "Mostra la guida al posizionamento", sGuideD: "La barra in alto che spiega come posizionare una nota.", sUndo: "Mostra “Annulla” dopo l’eliminazione", sUndoD: "Una breve barra per recuperare una nota eliminata.",
      markDone: "Segna come fatta", reopen: "Riapri",
      qAll: "Tutte", qLinks: "Link", noMatch: "Nessun risultato", noMatchX: "Prova un altro filtro.", siteEmpty: "Ancora nessuna nota su questo sito", siteTip: "Note da tutte le pagine di {host}, dalle più recenti.", filters: "Filtri rapidi",
      pageTip: "Le note appuntate sulla pagina attuale.", recentTip: "Le tue ultime note da tutti i siti, dalle più recenti.", recentTipOn: "Ultime note su {host}, dalle più recenti.", only: "Solo", clearFilt: "Mostra tutti i siti",
      onPage: "Sulla pagina", onEl: "Su elemento", link1: "{n} link", linkN: "{n} link", showIt: "Mostra", openIt: "Apri",
      viewAll: "Vedi tutto",
      hint: "Premi + Nuova nota, poi clicca sulla pagina.", lockS: "Apri un sito qualsiasi per aggiungere note.",
      how: "Come funziona", tour: "Tour di 1 min", sites: "I tuoi siti", thisPage: "Questa pagina", thisSite: "Questo sito", everywhere: "Ovunque", openAll: "Apri tutte le note", recent: "Recenti", allNotes: "Tutte le note", newNote: "Nuova nota", tips: "Suggerimenti e colori", watch: "Guarda il tour",
      tip1: "<b>Seleziona il testo</b> per evidenziarlo, o clicca ovunque.", tip2: "<b>Trascina</b> il + NOTE del dock ovunque nella pagina.", tip3: "Tieni premuto <b>Shift</b> per fissare una nota a un elemento.",
      open: "Aperta", done: "Fatta", hl: "Evidenziato", el: "Elemento", link: "Link", free: "Libera", show: "Mostra note", settings: "Impostazioni", lang: "Lingua", auto: "Auto", note: "Nota",
      focusNote: "Mostra questa nota nella pagina", openOn: "Apri {host} su questa nota", curSite: "Sito attuale", everySite: "Tutti i siti", allSites: "Tutti i siti", sitesEmpty: "I tuoi siti appariranno qui dopo la prima nota.", site1: "{n} sito", siteN: "{n} siti",
      showRecentOn: "Note recenti su {host}", showRecent: "Note recenti", showPage: "Note di questa pagina", openAllMine: "Apri tutte le mie note", none: "Ancora nessuna nota", na: "Non disponibile qui", pick: "Scegli un sito", nOpen: "{n} aperte", nDone: "{n} fatte",
      onPage1: "su {n} pagina", onPageN: "su {n} pagine", across1: "su {n} sito", acrossN: "su {n} siti", start: "Inizia ad appuntare",
      firstT: "La tua prima nota è a un clic", firstX: "Appunta una nota ovunque su un sito — la ritrovi quando torni.", addFirst: "Aggiungi la prima nota", kNew: "nuova nota", kSel: "Seleziona", kHl: "evidenzia",
      lockT: "Qui niente note", lockX: "Le pagine del browser e degli store sono protette. Apri un sito qualsiasi per appuntare note.", cleanT: "Questa pagina è pulita", cleanX: "Ancora nessuna nota su {host}. Aggiungine una e clicca ovunque — o seleziona del testo per evidenziarlo.", addHere: "Aggiungi una nota qui", seeRecent: "Vedi recenti ({n})", more: "+ altre {n} in Tutte le note", thisTab: "Questa scheda", empty: "(nota vuota)",
      back: "Tutte le note", onPages: "Sulle pagine", sVis: "Mostra le note sulle pagine", sVisD: "Nascondi tutte le note insieme senza eliminare nulla. Come Alt+Shift+H.", sAutoMin: "Riduci le note dopo la scrittura", sAutoMinD: "Quando clicchi fuori da una nota con testo, si chiude in una linguetta.", sFold: "Comprimi il dock + NOTE", sFoldD: "Riduce il dock mobile al solo logo. Clicca il logo per espanderlo.", sSnap: "Salva screenshot", sPanel: "Apri nel pannello laterale", sPanelD: "Il clic sull’icona apre un pannello laterale ridimensionabile invece del menu.", sSnapD: "Salva un piccolo screenshot per ogni nota per scorrere l’elenco facilmente.", sLangD: "Auto segue la lingua del browser.",
      keys: "Scorciatoie da tastiera", changeKeys: "Cambia scorciatoie", data: "I tuoi dati", notes: "Note", pages: "Pagine", sitesW: "Siti", storage: "Spazio", dataX: "Tutto resta solo su questo dispositivo — nessun account, nessun server. Esporta un backup prima di cambiare browser.",
      export: "Esporta backup (.json)", import: "Importa", clearShots: "Cancella screenshot", wipe: "Elimina tutto", about: "Info", madeBy: "Creato da Hamza Guetioui", saved: "Salvato", notSet: "Non impostata",
      cPlace: "Nuova nota (o evidenzia il testo selezionato)", cToggle: "Mostra / nascondi le note", cPopup: "Apri questo popup", exported: "Backup esportato", imported: "{n} nuove note importate", badJson: "Questo file non è un JSON valido.", noPages: "Nessuna pagina trovata nel file.",
      noShots: "Nessuno screenshot da cancellare", confShots: "Rimuovere tutti i {n} screenshot? Le note restano.", shotsCleared: "Screenshot cancellati", nothing: "Niente da eliminare", confWipe: "Eliminare TUTTE le note e gli screenshot? Esporta prima un backup. Non si può annullare.", wiped: "Tutto eliminato",
    },
    ru: {
      showHere: "Заметки этой страницы", showHereD: "Только для текущей страницы",
      urgent: "Срочно",
      secNotes: "Заметки на страницах", secToolbar: "Панель", secHelp: "Подсказки и сообщения", secMore: "Ещё", secDev: "Разработка", devWarnL: "Важно", devWarn: "Для разработчиков. Режим инспекции меняет работу расширения: вы видите и добавляете только заметки к элементам, а обычные заметки скрыты, пока режим не выключен. Не уверены? Оставьте выключенным.", sWhen: "Когда показывать заметки", sWhenD: "Сразу или только когда вы попросите.", whenAuto: "Сразу", whenAutoD: "Как только откроется страница", whenClick: "Когда открываю Page Notes", whenClickD: "Нажмите на значок, чтобы увидеть", sDock: "Панель на страницах", sDockD: "Маленькая панель в углу для добавления и просмотра заметок.", dockAuto: "По необходимости", dockAutoD: "Видна, если на странице есть заметки", dockMini: "Всегда, маленькая", dockMiniD: "Всегда в виде значка", dockOff: "Скрыта", dockOffD: "Не показывается - используйте клавиши", sPos: "Положение панели", sPosD: "Перетащите панель за логотип.", resetPos: "Сбросить", posReset: "Панель снова в углу", gmFullD: "Открывается при размещении", gmCompactD: "Только кнопка ?",
      cEl: "Прикрепить заметку к элементу", cHl: "Выделить текст с заметкой",
      sGuideMode: "Стиль подсказки", sGuideModeD: "Полная открывается при размещении. Компактная показывает только «?», по которому можно нажать.", gmFull: "Полная подсказка", gmCompact: "Компактная (нажмите ?)",
      showTips: "Показывать подсказки", showTipsD: "Подсказки и сообщения на страницах", sTips: "Подсказки на страницах", sTipsD: "Подсказки и короткие сообщения при добавлении заметок. Отключите, когда освоитесь.", sGuide: "Показывать подсказку размещения", sGuideD: "Панель сверху, которая объясняет, как разместить заметку.", sUndo: "Показывать «Отменить» после удаления", sUndoD: "Короткая панель, чтобы вернуть удалённую заметку.",
      markDone: "Отметить как готово", reopen: "Открыть снова",
      qAll: "Все", qLinks: "Ссылки", noMatch: "Ничего не найдено", noMatchX: "Попробуйте другой фильтр.", siteEmpty: "На этом сайте заметок пока нет", siteTip: "Заметки со всех страниц {host}, сначала новые.", filters: "Быстрые фильтры",
      pageTip: "Заметки на текущей странице.", recentTip: "Ваши последние заметки со всех сайтов, сначала новые.", recentTipOn: "Последние заметки на {host}, сначала новые.", only: "Только", clearFilt: "Показать все сайты",
      onPage: "На странице", onEl: "На элементе", link1: "ссылок: {n}", linkN: "ссылок: {n}", showIt: "Показать", openIt: "Открыть",
      viewAll: "Все",
      hint: "Нажмите «+ Новая заметка», затем кликните на странице.", lockS: "Откройте любой сайт, чтобы добавить заметки.",
      how: "Как это работает", tour: "Тур за 1 мин", sites: "Ваши сайты", thisPage: "Эта страница", thisSite: "Этот сайт", everywhere: "Везде", openAll: "Открыть все заметки", recent: "Недавние", allNotes: "Все заметки", newNote: "Новая заметка", tips: "Советы и цвета", watch: "Смотреть тур",
      tip1: "<b>Выделите текст</b>, чтобы подсветить его, или кликните где угодно.", tip2: "<b>Перетащите</b> + NOTE из панели в любое место страницы.", tip3: "Удерживайте <b>Shift</b>, чтобы прикрепить заметку к элементу.",
      open: "Открыта", done: "Готово", hl: "Выделение", el: "Элемент", link: "Ссылка", free: "Свободная", show: "Показывать заметки", settings: "Настройки", lang: "Язык", auto: "Авто", note: "Заметка",
      focusNote: "Показать заметку на странице", openOn: "Открыть {host} на этой заметке", curSite: "Текущий сайт", everySite: "Все сайты", allSites: "Все сайты", sitesEmpty: "Ваши сайты появятся здесь после первой заметки.", site1: "сайтов: {n}", siteN: "сайтов: {n}",
      showRecentOn: "Недавние заметки на {host}", showRecent: "Недавние заметки", showPage: "Заметки этой страницы", openAllMine: "Открыть все мои заметки", none: "Заметок пока нет", na: "Здесь недоступно", pick: "Выберите сайт", nOpen: "открыто: {n}", nDone: "готово: {n}",
      onPage1: "страниц: {n}", onPageN: "страниц: {n}", across1: "сайтов: {n}", acrossN: "сайтов: {n}", start: "Начните закреплять",
      firstT: "Первая заметка — в один клик", firstX: "Закрепите заметку на любом сайте — она останется, когда вы вернётесь.", addFirst: "Добавить заметку", kNew: "новая заметка", kSel: "Выделите текст", kHl: "подсветка",
      lockT: "Здесь заметки недоступны", lockX: "Страницы браузера и магазинов защищены. Откройте любой сайт, чтобы закреплять заметки.", cleanT: "На этой странице пусто", cleanX: "На {host} заметок пока нет. Добавьте одну и кликните где угодно — или сначала выделите текст.", addHere: "Добавить заметку", seeRecent: "Недавние ({n})", more: "+ ещё {n} во всех заметках", thisTab: "Эта вкладка", empty: "(пустая заметка)",
      back: "Все заметки", onPages: "На страницах", sVis: "Показывать заметки на страницах", sVisD: "Скройте все заметки сразу, ничего не удаляя. Как Alt+Shift+H.", sAutoMin: "Сворачивать заметки после ввода", sAutoMinD: "Если щёлкнуть вне заметки с текстом, она свернётся во вкладку.", sFold: "Свернуть панель + NOTE", sFoldD: "Сжимает плавающую панель до логотипа. Нажмите на логотип, чтобы развернуть.", sSnap: "Сохранять снимки страниц", sPanel: "Открывать в боковой панели", sPanelD: "Значок открывает боковую панель с изменяемым размером вместо меню.", sSnapD: "Хранит небольшой снимок для каждой заметки, чтобы список было легко просматривать.", sLangD: "Авто — язык вашего браузера.",
      keys: "Горячие клавиши", changeKeys: "Изменить клавиши", data: "Ваши данные", notes: "Заметки", pages: "Страницы", sitesW: "Сайты", storage: "Память", dataX: "Всё хранится только на этом устройстве — без аккаунта и сервера. Экспортируйте копию перед сменой браузера.",
      export: "Экспорт копии (.json)", import: "Импорт", clearShots: "Удалить снимки", wipe: "Удалить всё", about: "О расширении", madeBy: "Автор — Hamza Guetioui", saved: "Сохранено", notSet: "Не задано",
      cPlace: "Новая заметка (или подсветить выделенный текст)", cToggle: "Показать / скрыть заметки", cPopup: "Открыть это окно", exported: "Копия экспортирована", imported: "Импортировано новых заметок: {n}", badJson: "Файл не является корректным JSON.", noPages: "В файле не найдено страниц.",
      noShots: "Нет снимков для удаления", confShots: "Удалить все снимки ({n})? Заметки останутся.", shotsCleared: "Снимки удалены", nothing: "Нечего удалять", confWipe: "Удалить ВСЕ заметки и снимки? Сначала сделайте экспорт. Это нельзя отменить.", wiped: "Всё удалено",
    },
    ar: {
      showHere: "إظهار ملاحظات هذه الصفحة", showHereD: "لهذه الصفحة فقط",
      urgent: "عاجل",
      secNotes: "الملاحظات على الصفحات", secToolbar: "شريط الأدوات", secHelp: "المساعدة والرسائل", secMore: "المزيد", secDev: "للمطورين", devWarnL: "اقرأ أولاً", devWarn: "للمطورين. تفعيل وضع الفحص يغيّر طريقة عمل الإضافة: سترى وتضيف ملاحظات العناصر فقط، وتُخفى ملاحظاتك العادية حتى توقفه. لست متأكداً؟ اتركه متوقفاً.", sWhen: "متى تظهر الملاحظات", sWhenD: "أظهر الملاحظات فورًا أو فقط عندما تطلبها.", whenAuto: "فورًا", whenAutoD: "بمجرد فتح الصفحة", whenClick: "عند فتح Page Notes", whenClickD: "انقر الأيقونة لرؤيتها", sDock: "شريط الأدوات على الصفحات", sDockD: "الشريط الصغير في الزاوية لإضافة الملاحظات وتصفحها.", dockAuto: "عند الحاجة", dockAutoD: "يظهر إذا كانت للصفحة ملاحظات", dockMini: "دائمًا، صغير", dockMiniD: "دائمًا كأيقونة صغيرة", dockOff: "مخفي", dockOffD: "لا يظهر أبدًا - استخدم الاختصارات", sPos: "موضع الشريط", sPosD: "اسحب الشريط من شعاره لتحريكه.", resetPos: "إعادة الضبط", posReset: "عاد الشريط إلى الزاوية", gmFullD: "يفتح أثناء وضع الملاحظة", gmCompactD: "فقط زر ؟ للنقر",
      cEl: "تثبيت ملاحظة على عنصر", cHl: "تمييز نص مع ملاحظة",
      sGuideMode: "نمط الدليل", sGuideModeD: "الكامل يفتح الدليل أثناء الوضع. المختصر يُظهر فقط «؟» يمكنك النقر عليه.", gmFull: "دليل كامل", gmCompact: "مختصر (انقر ؟)",
      showTips: "إظهار النصائح", showTipsD: "إرشادات ورسائل على الصفحات", sTips: "إظهار النصائح على الصفحات", sTipsD: "إرشادات ورسائل قصيرة أثناء إضافة الملاحظات. أوقفها عندما تعتاد عليها.", sGuide: "إظهار دليل الوضع", sGuideD: "الشريط العلوي الذي يشرح كيفية وضع ملاحظة.", sUndo: "إظهار «تراجع» بعد الحذف", sUndoD: "شريط قصير لاستعادة ملاحظة محذوفة.",
      markDone: "تحديد كمنجزة", reopen: "إعادة فتح",
      qAll: "الكل", qLinks: "روابط", noMatch: "لا نتائج", noMatchX: "جرّب فلترًا آخر.", siteEmpty: "لا ملاحظات على هذا الموقع بعد", siteTip: "ملاحظات من كل صفحات {host}، الأحدث أولًا.", filters: "فلاتر سريعة",
      pageTip: "الملاحظات المثبتة على الصفحة الحالية.", recentTip: "أحدث ملاحظاتك من كل المواقع، الأحدث أولًا.", recentTipOn: "أحدث الملاحظات على {host}، الأحدث أولًا.", only: "فقط", clearFilt: "عرض كل المواقع",
      onPage: "على الصفحة", onEl: "على عنصر", link1: "{n} رابط", linkN: "{n} روابط", showIt: "عرض", openIt: "فتح",
      viewAll: "عرض الكل",
      hint: "اضغط + ملاحظة جديدة ثم انقر على الصفحة.", lockS: "افتح أي موقع لإضافة ملاحظات.",
      how: "كيف يعمل", tour: "جولة دقيقة", sites: "مواقعك", thisPage: "هذه الصفحة", thisSite: "هذا الموقع", everywhere: "في كل مكان", openAll: "فتح كل الملاحظات", recent: "الأحدث", allNotes: "كل الملاحظات", newNote: "ملاحظة جديدة", tips: "نصائح وألوان", watch: "شاهد الجولة",
      tip1: "<b>حدّد نصًا</b> لتمييزه، أو انقر في أي مكان.", tip2: "<b>اسحب</b> زر + NOTE إلى أي مكان في الصفحة.", tip3: "اضغط <b>Shift</b> لتثبيت الملاحظة على عنصر.",
      open: "مفتوحة", done: "منجزة", hl: "تمييز", el: "عنصر", link: "رابط", free: "حرّة", show: "إظهار الملاحظات", settings: "الإعدادات", lang: "اللغة", auto: "تلقائي", note: "ملاحظة",
      focusNote: "عرض هذه الملاحظة في الصفحة", openOn: "فتح {host} على هذه الملاحظة", curSite: "الموقع الحالي", everySite: "كل المواقع", allSites: "كل المواقع", sitesEmpty: "ستظهر مواقعك هنا بعد أول ملاحظة.", site1: "{n} موقع", siteN: "{n} مواقع",
      showRecentOn: "أحدث الملاحظات على {host}", showRecent: "أحدث الملاحظات", showPage: "ملاحظات هذه الصفحة", openAllMine: "فتح كل ملاحظاتي", none: "لا ملاحظات بعد", na: "غير متاح هنا", pick: "اختر موقعًا", nOpen: "{n} مفتوحة", nDone: "{n} منجزة",
      onPage1: "في {n} صفحة", onPageN: "في {n} صفحات", across1: "عبر {n} موقع", acrossN: "عبر {n} مواقع", start: "ابدأ بالتثبيت",
      firstT: "ملاحظتك الأولى على بُعد نقرة", firstX: "ثبّت ملاحظة في أي مكان على أي موقع — ستجدها عند عودتك.", addFirst: "أضف أول ملاحظة", kNew: "ملاحظة جديدة", kSel: "حدّد نصًا", kHl: "تمييز",
      lockT: "لا يمكن إضافة ملاحظات هنا", lockX: "صفحات المتصفح والمتاجر محمية. افتح أي موقع لتثبيت الملاحظات.", cleanT: "هذه الصفحة فارغة", cleanX: "لا توجد ملاحظات على {host} بعد. أضف واحدة وانقر في أي مكان — أو حدّد نصًا لتمييزه.", addHere: "أضف ملاحظة هنا", seeRecent: "عرض الأحدث ({n})", more: "+ {n} أخرى في كل الملاحظات", thisTab: "هذا التبويب", empty: "(ملاحظة فارغة)",
      back: "كل الملاحظات", onPages: "على الصفحات", sVis: "إظهار الملاحظات على الصفحات", sVisD: "أخفِ كل الملاحظات مرة واحدة دون حذف شيء. مثل Alt+Shift+H.", sAutoMin: "تصغير الملاحظات بعد الكتابة", sAutoMinD: "عند النقر خارج ملاحظة تحتوي على نص، تُطوى إلى علامة تبويب.", sFold: "طيّ شريط + NOTE", sFoldD: "يصغّر الشريط العائم إلى شعاره فقط. انقر الشعار لفتحه.", sSnap: "حفظ لقطات الصفحة", sPanel: "الفتح في اللوحة الجانبية", sPanelD: "النقر على الأيقونة يفتح لوحة جانبية قابلة لتغيير الحجم بدلاً من القائمة.", sSnapD: "يحفظ لقطة صغيرة مع كل ملاحظة لتصفح القائمة بسهولة.", sLangD: "التلقائي يتبع لغة متصفحك.",
      keys: "اختصارات لوحة المفاتيح", changeKeys: "تغيير الاختصارات", data: "بياناتك", notes: "ملاحظات", pages: "صفحات", sitesW: "مواقع", storage: "التخزين", dataX: "كل شيء محفوظ على هذا الجهاز فقط — بلا حساب ولا خادم. صدّر نسخة احتياطية قبل تغيير المتصفح.",
      export: "تصدير نسخة (.json)", import: "استيراد", clearShots: "مسح اللقطات", wipe: "حذف الكل", about: "حول", madeBy: "من صنع حمزة كتيوي", saved: "تم الحفظ", notSet: "غير معيّن",
      cPlace: "ملاحظة جديدة (أو تمييز النص المحدد)", cToggle: "إظهار / إخفاء الملاحظات", cPopup: "فتح هذه النافذة", exported: "تم تصدير النسخة", imported: "تم استيراد {n} ملاحظة جديدة", badJson: "هذا الملف ليس JSON صالحًا.", noPages: "لم يتم العثور على صفحات في هذا الملف.",
      noShots: "لا توجد لقطات لمسحها", confShots: "حذف كل اللقطات ({n})؟ ستبقى ملاحظاتك.", shotsCleared: "تم مسح اللقطات", nothing: "لا شيء لحذفه", confWipe: "حذف كل الملاحظات واللقطات؟ صدّر نسخة أولًا إن أردت. لا يمكن التراجع.", wiped: "تم حذف كل شيء",
    },
    zh: {
      showHere: "显示本页笔记", showHereD: "仅对当前页面",
      urgent: "紧急",
      secNotes: "页面上的笔记", secToolbar: "工具栏", secHelp: "帮助与消息", secMore: "更多", secDev: "开发", devWarnL: "请先阅读", devWarn: "面向开发者。开启检查模式会改变扩展的工作方式：你只能查看和添加元素笔记，普通笔记会被隐藏，直到关闭此模式。不确定？请保持关闭。", sWhen: "何时显示笔记", sWhenD: "立即显示，或仅在你需要时显示。", whenAuto: "立即", whenAutoD: "页面一打开就显示", whenClick: "打开 Page Notes 时", whenClickD: "点击工具栏图标查看", sDock: "页面工具栏", sDockD: "角落里用于添加和浏览笔记的小工具栏。", dockAuto: "需要时", dockAutoD: "页面有笔记时显示", dockMini: "始终（迷你）", dockMiniD: "始终显示为小图标", dockOff: "隐藏", dockOffD: "从不显示 - 使用快捷键", sPos: "工具栏位置", sPosD: "拖动工具栏的图标即可移动。", resetPos: "重置位置", posReset: "工具栏已回到角落", gmFullD: "放置笔记时自动打开", gmCompactD: "只显示可点击的 ?",
      cEl: "将笔记固定到元素", cHl: "高亮文本并添加笔记",
      sGuideMode: "引导样式", sGuideModeD: "完整：放置时自动打开引导。精简：只显示可点击的“?”。", gmFull: "完整引导", gmCompact: "精简（点击 ?）",
      showTips: "显示提示", showTipsD: "网页上的引导和消息", sTips: "在网页上显示提示", sTipsD: "添加笔记时的引导和简短消息。熟悉后可以关闭。", sGuide: "显示放置引导", sGuideD: "顶部说明如何放置笔记的提示栏。", sUndo: "删除后显示“撤销”", sUndoD: "一个简短的提示栏，可恢复已删除的笔记。",
      markDone: "标记为已完成", reopen: "重新打开",
      qAll: "全部", qLinks: "链接", noMatch: "没有匹配项", noMatchX: "试试其他筛选。", siteEmpty: "此网站还没有笔记", siteTip: "{host} 所有页面的笔记，最新的在前。", filters: "快速筛选",
      pageTip: "当前页面上的笔记。", recentTip: "来自所有网站的最新笔记，最新的在前。", recentTipOn: "{host} 上的最新笔记，最新的在前。", only: "仅", clearFilt: "显示所有网站",
      onPage: "页面上", onEl: "元素上", link1: "{n} 个链接", linkN: "{n} 个链接", showIt: "显示", openIt: "打开",
      viewAll: "查看全部",
      hint: "点击“+ 新建笔记”，然后点击页面。", lockS: "打开任意网站即可添加笔记。",
      how: "使用说明", tour: "1 分钟导览", sites: "你的网站", thisPage: "本页", thisSite: "本站", everywhere: "全部", openAll: "打开所有笔记", recent: "最近", allNotes: "所有笔记", newNote: "新建笔记", tips: "提示与颜色", watch: "观看导览",
      tip1: "先<b>选中文本</b>即可高亮，或点击任意位置。", tip2: "<b>拖动</b>停靠栏的 + NOTE 到页面任意位置。", tip3: "按住 <b>Shift</b> 可将笔记固定到元素上。",
      open: "未完成", done: "已完成", hl: "高亮", el: "元素", link: "链接", free: "自由", show: "显示笔记", settings: "设置", lang: "语言", auto: "自动", note: "笔记",
      focusNote: "在页面上显示此笔记", openOn: "在此笔记处打开 {host}", curSite: "当前网站", everySite: "所有网站", allSites: "所有网站", sitesEmpty: "添加第一条笔记后，你的网站会显示在这里。", site1: "{n} 个网站", siteN: "{n} 个网站",
      showRecentOn: "{host} 上的最近笔记", showRecent: "最近笔记", showPage: "本页笔记", openAllMine: "打开我的所有笔记", none: "暂无笔记", na: "此处不可用", pick: "选择网站", nOpen: "{n} 未完成", nDone: "{n} 已完成",
      onPage1: "{n} 个页面", onPageN: "{n} 个页面", across1: "{n} 个网站", acrossN: "{n} 个网站", start: "开始添加",
      firstT: "一键添加第一条笔记", firstX: "在任意网站任意位置贴一条笔记——下次回来它还在。", addFirst: "添加第一条笔记", kNew: "新建笔记", kSel: "选中文本", kHl: "高亮",
      lockT: "此处无法添加笔记", lockX: "浏览器和应用商店页面受保护。打开任意网站即可添加笔记。", cleanT: "本页还没有笔记", cleanX: "{host} 上还没有笔记。新建后点击任意位置——或先选中文本进行高亮。", addHere: "在此添加笔记", seeRecent: "查看最近（{n}）", more: "+ 所有笔记中还有 {n} 条", thisTab: "此标签页", empty: "（空笔记）",
      back: "所有笔记", onPages: "页面上", sVis: "在页面上显示笔记", sVisD: "一次隐藏所有笔记，不会删除任何内容。同 Alt+Shift+H。", sAutoMin: "写完后最小化笔记", sAutoMinD: "在有内容的笔记外点击时，它会折叠成标签。", sFold: "折叠 + NOTE 停靠栏", sFoldD: "将浮动停靠栏缩小为图标，点击图标展开。", sSnap: "保存页面截图", sPanel: "在侧边栏中打开", sPanelD: "点击工具栏图标将打开可调整大小的侧边栏，而不是下拉菜单。", sSnapD: "为每条笔记保存一张小截图，方便浏览列表。", sLangD: "自动 = 跟随浏览器语言。",
      keys: "键盘快捷键", changeKeys: "修改快捷键", data: "你的数据", notes: "笔记", pages: "页面", sitesW: "网站", storage: "存储", dataX: "所有内容仅保存在本设备——无需账号，没有服务器。更换浏览器前请先导出备份。",
      export: "导出备份 (.json)", import: "导入", clearShots: "清除截图", wipe: "全部删除", about: "关于", madeBy: "作者 Hamza Guetioui", saved: "已保存", notSet: "未设置",
      cPlace: "新建笔记（或高亮选中的文本）", cToggle: "显示 / 隐藏笔记", cPopup: "打开此弹窗", exported: "备份已导出", imported: "已导入 {n} 条新笔记", badJson: "该文件不是有效的 JSON。", noPages: "文件中没有找到页面。",
      noShots: "没有可清除的截图", confShots: "删除全部 {n} 张截图？笔记会保留。", shotsCleared: "截图已清除", nothing: "没有可删除的内容", confWipe: "删除所有笔记和截图？如需备份请先导出。此操作无法撤销。", wiped: "已全部删除",
    },
    ja: {
      showHere: "このページのメモを表示", showHereD: "今のページだけ",
      urgent: "緊急",
      secNotes: "ページ上のメモ", secToolbar: "ツールバー", secHelp: "ヘルプとメッセージ", secMore: "その他", secDev: "開発", devWarnL: "先に読んで", devWarn: "開発者向け。検査モードをオンにすると拡張機能の動作が変わります：要素メモだけを表示・追加し、通常のメモはオフにするまで非表示になります。よくわからなければオフのままにしてください。", sWhen: "メモを表示するタイミング", sWhenD: "すぐに表示するか、必要なときだけ表示します。", whenAuto: "すぐに", whenAutoD: "ページを開いたらすぐ", whenClick: "Page Notes を開いたとき", whenClickD: "アイコンをクリックで表示", sDock: "ページのツールバー", sDockD: "メモの追加・閲覧用の小さなバー。", dockAuto: "必要なとき", dockAutoD: "メモがあるページで表示", dockMini: "常に（小さく）", dockMiniD: "常に小さなアイコンで表示", dockOff: "非表示", dockOffD: "表示しない - ショートカットを使用", sPos: "ツールバーの位置", sPosD: "ロゴをドラッグして移動できます。", resetPos: "位置をリセット", posReset: "ツールバーを角に戻しました", gmFullD: "配置中に開く", gmCompactD: "クリックできる ? のみ",
      cEl: "要素にメモを固定", cHl: "テキストをハイライトしてメモ",
      sGuideMode: "ガイドの表示", sGuideModeD: "フル：配置中にガイドを表示。コンパクト：クリックできる「?」だけを表示。", gmFull: "フルガイド", gmCompact: "コンパクト（? をクリック）",
      showTips: "ヒントを表示", showTipsD: "ページ上のガイドとメッセージ", sTips: "ページにヒントを表示", sTipsD: "メモ追加時のガイドと短いメッセージ。慣れたらオフにできます。", sGuide: "配置ガイドを表示", sGuideD: "メモの置き方を説明する上部のバー。", sUndo: "削除後に「元に戻す」を表示", sUndoD: "削除したメモを戻せる短いバー。",
      markDone: "完了にする", reopen: "未完了に戻す",
      qAll: "すべて", qLinks: "リンク", noMatch: "該当なし", noMatchX: "別のフィルターを試してください。", siteEmpty: "このサイトにはまだメモがありません", siteTip: "{host} の全ページのメモ（新しい順）。", filters: "クイックフィルター",
      pageTip: "今のページに貼ったメモ。", recentTip: "すべてのサイトの最新メモ（新しい順）。", recentTipOn: "{host} の最新メモ（新しい順）。", only: "のみ", clearFilt: "すべてのサイトを表示",
      onPage: "ページ上", onEl: "要素上", link1: "リンク {n}", linkN: "リンク {n}", showIt: "表示", openIt: "開く",
      viewAll: "すべて見る",
      hint: "「+ 新しいメモ」を押して、ページをクリック。", lockS: "任意のサイトを開いてメモを追加。",
      how: "使い方", tour: "1分ツアー", sites: "あなたのサイト", thisPage: "このページ", thisSite: "このサイト", everywhere: "すべて", openAll: "すべてのメモを開く", recent: "最近", allNotes: "すべてのメモ", newNote: "新しいメモ", tips: "ヒントと色", watch: "ツアーを見る",
      tip1: "先に<b>テキストを選択</b>するとハイライト、またはどこでもクリック。", tip2: "ドックの + NOTE をページの好きな場所へ<b>ドラッグ</b>。", tip3: "<b>Shift</b> を押しながらで要素にメモを固定。",
      open: "未完了", done: "完了", hl: "ハイライト", el: "要素", link: "リンク", free: "フリー", show: "メモを表示", settings: "設定", lang: "言語", auto: "自動", note: "メモ",
      focusNote: "このメモをページで表示", openOn: "このメモの位置で {host} を開く", curSite: "現在のサイト", everySite: "すべてのサイト", allSites: "すべてのサイト", sitesEmpty: "メモを貼るとここにサイトが表示されます。", site1: "{n} サイト", siteN: "{n} サイト",
      showRecentOn: "{host} の最近のメモ", showRecent: "最近のメモ", showPage: "このページのメモ", openAllMine: "すべてのメモを開く", none: "メモはまだありません", na: "ここでは使えません", pick: "サイトを選択", nOpen: "未完了 {n}", nDone: "完了 {n}",
      onPage1: "{n} ページ", onPageN: "{n} ページ", across1: "{n} サイト", acrossN: "{n} サイト", start: "メモを始めよう",
      firstT: "最初のメモはワンクリック", firstX: "どのサイトのどこにでもメモを貼れます。戻ってきても残っています。", addFirst: "最初のメモを追加", kNew: "新しいメモ", kSel: "テキスト選択", kHl: "ハイライト",
      lockT: "ここにはメモを貼れません", lockX: "ブラウザやストアのページは保護されています。任意のサイトを開いてメモを貼ってください。", cleanT: "このページにはメモがありません", cleanX: "{host} にはまだメモがありません。追加してどこでもクリック、またはテキストを選択してハイライト。", addHere: "ここにメモを追加", seeRecent: "最近を見る（{n}）", more: "+ すべてのメモに他 {n} 件", thisTab: "このタブ", empty: "（空のメモ）",
      back: "すべてのメモ", onPages: "ページ上", sVis: "ページにメモを表示", sVisD: "何も削除せずにすべてのメモを一度に非表示。Alt+Shift+H と同じ。", sAutoMin: "書いた後にメモを最小化", sAutoMinD: "テキストのあるメモの外をクリックすると、タブに折りたたまれます。", sFold: "+ NOTE ドックを折りたたむ", sFoldD: "フローティングドックをロゴだけに縮小。ロゴをクリックで展開。", sSnap: "ページのスナップショットを保存", sPanel: "サイドパネルで開く", sPanelD: "ツールバーのアイコンでドロップダウンの代わりにサイズ変更できるサイドパネルを開きます。", sSnapD: "各メモに小さなスクリーンショットを保存し、一覧を見やすくします。", sLangD: "自動はブラウザの言語に従います。",
      keys: "キーボードショートカット", changeKeys: "ショートカットを変更", data: "あなたのデータ", notes: "メモ", pages: "ページ", sitesW: "サイト", storage: "容量", dataX: "すべてこの端末だけに保存されます。アカウントもサーバーも不要。ブラウザを変える前にバックアップを書き出してください。",
      export: "バックアップを書き出す (.json)", import: "読み込む", clearShots: "スナップショットを消去", wipe: "すべて削除", about: "このアプリについて", madeBy: "制作 Hamza Guetioui", saved: "保存しました", notSet: "未設定",
      cPlace: "新しいメモ（または選択テキストをハイライト）", cToggle: "メモの表示 / 非表示", cPopup: "このポップアップを開く", exported: "バックアップを書き出しました", imported: "新しいメモを {n} 件読み込みました", badJson: "有効な JSON ファイルではありません。", noPages: "ファイルにページが見つかりません。",
      noShots: "消去するスナップショットはありません", confShots: "スナップショット {n} 件をすべて削除しますか？メモは残ります。", shotsCleared: "スナップショットを消去しました", nothing: "削除するものはありません", confWipe: "すべてのメモとスナップショットを削除しますか？必要なら先に書き出してください。元に戻せません。", wiped: "すべて削除しました",
    },
  };
  var LANGS = [
    ["en", "English"], ["es", "Español"], ["fr", "Français"], ["de", "Deutsch"], ["pt", "Português"],
    ["it", "Italiano"], ["ru", "Русский"], ["ar", "العربية"], ["zh", "中文"], ["ja", "日本語"],
  ];
  var RTL = { ar: 1 };

  /**
   * Pick the language to use: the saved choice, else the browser language, else English.
   * @param {string} pref - saved preference ("auto", unset or a language code)
   * @returns {string} a language code present in D
   */
  function resolve(pref) {
    if (pref && pref !== "auto" && D[pref]) return pref;
    var nav = (navigator.languages && navigator.languages[0]) || navigator.language || "en";
    var base = String(nav).toLowerCase().split("-")[0];
    return D[base] ? base : "en";
  }
  /**
   * Translate a key in the current language (PN.lang) and fill {placeholders}.
   * @param {string} key - string key
   * @param {Object} vars - placeholder values, e.g. { n: 3 } (optional)
   * @returns {string}
   */
  function t(key, vars) {
    var s = (D[PN.lang] && D[PN.lang][key]) || D.en[key] || key;
    if (vars) for (var k in vars) s = s.split("{" + k + "}").join(vars[k]);
    return s;
  }
  /**
   * Singular/plural pick: t1 for n === 1, tN otherwise.
   * @param {string} one - key for the singular text
   * @param {string} many - key for the plural text
   * @param {number} n - count (also passed as {n})
   * @returns {string}
   */
  function tn(one, many, n) {
    return t(n === 1 ? one : many, { n: n });
  }
  /**
   * Translate every data-i18n* element and set the page lang/dir.
   * @param {HTMLElement} root - element to translate (defaults to document)
   */
  function apply(root) {
    root = root || document;
    var doc = document.documentElement;
    doc.lang = PN.lang;
    doc.dir = RTL[PN.lang] ? "rtl" : "ltr";
    root.querySelectorAll("[data-i18n]").forEach(function (n) {
      n.textContent = t(n.getAttribute("data-i18n"));
    });
    root.querySelectorAll("[data-i18n-html]").forEach(function (n) {
      n.innerHTML = t(n.getAttribute("data-i18n-html")); // trusted strings from this file only
    });
    root.querySelectorAll("[data-i18n-title]").forEach(function (n) {
      n.title = t(n.getAttribute("data-i18n-title"));
    });
    root.querySelectorAll("[data-i18n-aria]").forEach(function (n) {
      n.setAttribute("aria-label", t(n.getAttribute("data-i18n-aria")));
    });
  }
  /**
   * Read settings.lang, set PN.lang, translate the page, then run cb.
   * @param {Function} cb - called when done (optional)
   */
  function init(cb) {
    chrome.storage.local.get("settings", function (r) {
      PN.langPref = (r.settings && r.settings.lang) || "auto";
      PN.lang = resolve(PN.langPref);
      apply();
      if (cb) cb();
    });
  }
  /**
   * Fill a <select> with Auto + languages and save the choice (then reload to re-render).
   * @param {HTMLElement} sel - the <select> element
   */
  function picker(sel) {
    sel.textContent = "";
    var o = document.createElement("option");
    o.value = "auto";
    o.textContent = t("auto") + " · " + (LANGS.filter(function (l) { return l[0] === resolve("auto"); })[0] || LANGS[0])[1];
    sel.append(o);
    LANGS.forEach(function (l) {
      var op = document.createElement("option");
      op.value = l[0];
      op.textContent = l[0].toUpperCase() + " · " + l[1];
      sel.append(op);
    });
    sel.value = PN.langPref || "auto";
    sel.onchange = function () {
      chrome.storage.local.get("settings", function (r) {
        var s = r.settings || {};
        s.lang = sel.value;
        chrome.storage.local.set({ settings: s }, function () {
          location.reload();
        });
      });
    };
  }

  /**
   * Save the chosen language in settings.lang and reload the page.
   * @param {string} code - language code or "auto"
   */
  function save(code) {
    chrome.storage.local.get("settings", function (r) {
      var s = r.settings || {};
      s.lang = code;
      chrome.storage.local.set({ settings: s }, function () {
        location.reload();
      });
    });
  }
  /**
   * Native name of a language (English if unknown).
   * @param {string} code - language code
   * @returns {string}
   */
  function nameOf(code) {
    return (LANGS.filter(function (l) { return l[0] === code; })[0] || LANGS[0])[1];
  }
  /**
   * Compact language button (shows "EN") + custom menu that opens upward.
   * @param {HTMLElement} btn - toggle button
   * @param {HTMLElement} list - menu list (<ul>) filled with options
   * @param {HTMLElement} codeEl - element that shows the current language code
   */
  function menu(btn, list, codeEl) {
    codeEl.textContent = PN.lang.toUpperCase();
    btn.title = t("lang") + " · " + nameOf(PN.lang);
    var CK = '<svg class="ck" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 5.2 4.2 7.4 8 2.8"/></svg>';
    /**
     * Build one menu option.
     * @param {string} code - language code or "auto"
     * @param {string} cd - short code shown on the left
     * @param {string} name - label
     * @returns {HTMLElement} the <li>
     */
    function item(code, cd, name) {
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "option");
      b.setAttribute("aria-selected", String((PN.langPref || "auto") === code));
      var c = document.createElement("span");
      c.className = "cd";
      c.textContent = cd;
      var n = document.createElement("span");
      n.className = "nm";
      n.textContent = name;
      b.append(c, n);
      b.insertAdjacentHTML("beforeend", CK);
      b.onclick = function () {
        if ((PN.langPref || "auto") === code) return close();
        save(code);
      };
      li.append(b);
      return li;
    }
    list.textContent = "";
    list.append(item("auto", "A", t("auto") + " · " + nameOf(resolve("auto"))));
    var sep = document.createElement("li");
    sep.className = "sep";
    sep.setAttribute("aria-hidden", "true");
    list.append(sep);
    LANGS.forEach(function (l) {
      list.append(item(l[0], l[0].toUpperCase(), l[1]));
    });
    /** Show the menu and focus the selected option. */
    function open() {
      list.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      var cur = list.querySelector("[aria-selected=true]");
      if (cur) {
        cur.scrollIntoView({ block: "nearest" });
        cur.focus();
      }
    }
    /** Hide the menu. */
    function close() {
      list.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }
    btn.onclick = function (e) {
      e.stopPropagation();
      list.hidden ? open() : close();
    };
    document.addEventListener("click", function (e) {
      if (!list.hidden && !list.contains(e.target)) close();
    });
    /** Keyboard: Escape closes, arrow keys move between options. */
    list.addEventListener("keydown", function (e) {
      var items = Array.from(list.querySelectorAll("button"));
      var i = items.indexOf(document.activeElement);
      if (e.key === "Escape") {
        close();
        btn.focus();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
      }
    });
  }

  PN.lang = "en";
  PN.LANGS = LANGS;
  PN.t = t;
  PN.tn = tn;
  PN.applyI18n = apply;
  PN.initLang = init;
  PN.langPicker = picker;
  PN.langMenu = menu;
})();
