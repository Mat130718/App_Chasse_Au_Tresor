// Application du capitaine (téléphone du parent) : préparer les parcours,
// leurs étapes, les photos modèles et les QR codes, puis piloter la chasse.

(() => {
  const app = document.getElementById('app');
  const RAYON_METRES = 50;

  const EXEMPLE_NOISY = {
    nom: 'Boucle Noisy-le-Grand',
    etapes: [
      ['Espace Michel Simon (départ et arrivée)', 48.8459, 2.5534],
      ['Jardin des artistes', 48.845, 2.5513],
      ["Gymnase du Clos de l'Arche", 48.8443, 2.548],
      ['Siège IBM Jupiter', 48.8435, 2.5446],
      ['Lycée Évariste Galois', 48.8449, 2.5401],
      ['Parc Louis-Antoine de Bougainville', 48.8417, 2.5391],
      ['Lac et centre commercial Les Arcades', 48.8399, 2.5482],
      ["Skatepark du Mont d'Est", 48.8412, 2.5526],
      ['Piscine Les Nymphéas', 48.849, 2.5539],
      ['Mairie de Noisy-le-Grand', 48.8493, 2.5525],
      ["Miroir d'eau", 48.8518, 2.5492],
    ],
  };

  // ---------- Outils ----------

  function el(tag, attrs = {}, ...enfants) {
    const noeud = document.createElement(tag);
    for (const [cle, valeur] of Object.entries(attrs)) {
      if (valeur === null || valeur === undefined || valeur === false) continue;
      if (cle === 'class') noeud.className = valeur;
      else if (cle.startsWith('on')) noeud.addEventListener(cle.slice(2), valeur);
      else if (cle === 'html') noeud.innerHTML = valeur;
      else noeud.setAttribute(cle, valeur === true ? '' : valeur);
    }
    for (const enfant of enfants.flat()) {
      if (enfant === null || enfant === undefined || enfant === false) continue;
      noeud.append(enfant instanceof Node ? enfant : document.createTextNode(String(enfant)));
    }
    return noeud;
  }

  // Petites icônes au trait (24 × 24), dessinées dans la couleur du texte.
  const ICONES = {
    retour: '<path d="M15 18l-6-6 6-6"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    menu: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    photo: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    qr: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2"/>',
    lieu: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    viser: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    jouer: '<path d="M8 5.5v13l10.5-6.5z"/>',
    valider: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    annuler: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    liste: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
    crayon: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    copier: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    telecharger: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    importer: '<path d="M12 15V4M7 9l5-5 5 5M5 20h14"/>',
    poubelle: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    drapeau: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    trier: '<path d="M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4"/>',
    haut: '<path d="M6 15l6-6 6 6"/>',
    bas: '<path d="M6 9l6 6 6-6"/>',
    installer: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M12 7v7M9 11l3 3 3-3"/>',
    fermer: '<path d="M6 6l12 12M18 6L6 18"/>',
    image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 16l-5-5-8 8"/>',
    route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h8"/>',
    partager: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M7 11H5v10h14V11h-2"/>',
    etoile: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    ampoule: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    carte: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  };
  function ic(nom, classe = 'ic') {
    return el('span', {
      class: classe,
      'aria-hidden': 'true',
      html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONES[nom]}</svg>`,
    });
  }

  function formaterCoord(n) {
    return Number(n).toFixed(5).replace(/0+$/, '').replace(/\.$/, '');
  }

  function texteCoords(etape) {
    return `${formaterCoord(etape.lat)}, ${formaterCoord(etape.lng)}`;
  }

  function distanceMetres(a, b) {
    const R = 6371000;
    const rad = (d) => (d * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function texteDistance(m) {
    if (m < 1000) return `${Math.round(m / 10) * 10} m`;
    return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
  }

  function longueurParcours(etapes) {
    let total = 0;
    for (let i = 1; i < etapes.length; i++) total += distanceMetres(etapes[i - 1], etapes[i]);
    return total;
  }

  // Accepte « 48.8459, 2.5534 », « 48,8459 2,5534 » ou un lien Google Maps
  // (…/@48.8459,2.5534,17z ou …?q=48.8459,2.5534).
  function lireCoords(texte) {
    if (!texte) return null;
    const t = texte.trim();
    let m = t.match(/(-?\d{1,3}\.\d+)\s*[,;\s]\s*(-?\d{1,3}\.\d+)/);
    if (!m) {
      const fr = t.match(/(-?\d{1,3}),(\d+)\s*[;\s]\s*(-?\d{1,3}),(\d+)/);
      if (fr) m = [null, `${fr[1]}.${fr[2]}`, `${fr[3]}.${fr[4]}`];
    }
    if (!m) return null;
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
  }

  // Ce que contient le QR code : le lien du mode joueur avec les coordonnées
  // de l'étape, et rien d'autre (le téléphone enfant ne connaît que ce point).
  function contenuQr(etape) {
    const url = new URL('joueur.html', window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('lat', formaterCoord(etape.lat));
    url.searchParams.set('lng', formaterCoord(etape.lng));
    return url.toString();
  }

  // QR code de l'étape finale : déclenche la célébration sur le téléphone enfant.
  function contenuQrFin() {
    const url = new URL('joueur.html', window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('fin', '1');
    return url.toString();
  }

  function svgQr(texte) {
    const qr = qrcode(0, 'M');
    qr.addData(texte);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true });
  }

  function dateCourte(ms) {
    try {
      return new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    } catch (e) {
      return '';
    }
  }

  function pluriel(n, mot) {
    return `${n} ${mot}${n > 1 ? 's' : ''}`;
  }

  // Redimensionne la photo (côté max 1280 px, JPEG) pour garder un stockage léger.
  function preparerPhoto(fichier) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(fichier);
      const img = new Image();
      img.onload = () => {
        const max = 1280;
        const echelle = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * echelle);
        canvas.height = Math.round(img.naturalHeight * echelle);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Cette image n'a pas pu être lue."));
      };
      img.src = url;
    });
  }

  // ---------- Petits éléments d'interface ----------

  let minuteurToast = null;
  function toast(message) {
    const zone = document.getElementById('toast');
    zone.textContent = message;
    zone.hidden = false;
    clearTimeout(minuteurToast);
    minuteurToast = setTimeout(() => (zone.hidden = true), 2600);
  }

  function confirmer({ titre, texte, bouton = 'Supprimer', danger = true }) {
    return new Promise((resolve) => {
      const fermer = (reponse) => {
        voile.remove();
        resolve(reponse);
      };
      const voile = el(
        'div',
        { class: 'voile', onclick: (e) => e.target === voile && fermer(false) },
        el(
          'div',
          { class: 'boite', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'boite-titre' },
          el('h2', { id: 'boite-titre' }, titre),
          texte && el('p', {}, texte),
          el(
            'div',
            { class: 'rangee-boutons' },
            el('button', { class: 'btn', onclick: () => fermer(false) }, 'Annuler'),
            el('button', { class: danger ? 'btn btn-danger' : 'btn btn-principal', onclick: () => fermer(true) }, bouton)
          )
        )
      );
      document.body.append(voile);
      voile.querySelector('.btn-danger, .btn-principal').focus();
    });
  }

  function demanderTexte({ titre, valeur = '', bouton = 'Enregistrer', placeholder = '' }) {
    return new Promise((resolve) => {
      const fermer = (reponse) => {
        voile.remove();
        resolve(reponse);
      };
      const champ = el('input', { id: 'champ-dialogue', type: 'text', value: valeur, placeholder, autocomplete: 'off' });
      const formulaire = el(
        'form',
        {
          class: 'boite',
          role: 'dialog',
          'aria-modal': 'true',
          onsubmit: (e) => {
            e.preventDefault();
            const texte = champ.value.trim();
            if (texte) fermer(texte);
            else champ.focus();
          },
        },
        el('h2', {}, titre),
        champ,
        el(
          'div',
          { class: 'rangee-boutons' },
          el('button', { type: 'button', class: 'btn', onclick: () => fermer(null) }, 'Annuler'),
          el('button', { type: 'submit', class: 'btn btn-principal' }, bouton)
        )
      );
      const voile = el('div', { class: 'voile', onclick: (e) => e.target === voile && fermer(null) }, formulaire);
      document.body.append(voile);
      champ.focus();
      champ.select();
    });
  }

  // Feuille qui monte du bas de l'écran : menu d'actions ou contenu libre.
  function ouvrirFeuille(titre, ...contenu) {
    const fermer = () => voile.remove();
    const voile = el(
      'div',
      { class: 'voile voile-bas', onclick: (e) => e.target === voile && fermer() },
      el(
        'div',
        { class: 'feuille', role: 'dialog', 'aria-modal': 'true', 'aria-label': titre },
        el('div', { class: 'poignee', 'aria-hidden': 'true' }),
        el('div', { class: 'feuille-entete' }, el('h2', {}, titre), el('button', { class: 'btn-rond', 'aria-label': 'Fermer', onclick: fermer }, ic('fermer'))),
        ...contenu
      )
    );
    document.body.append(voile);
    return fermer;
  }

  function menuActions(titre, actions) {
    let fermer = () => {};
    const liste = el(
      'div',
      { class: 'menu-actions' },
      actions.filter(Boolean).map((a) =>
        a.pour
          ? el('label', { class: 'action', for: a.pour, onclick: () => setTimeout(fermer, 0) }, ic(a.icone), el('span', {}, a.libelle))
          : el(
              'button',
              {
                class: a.danger ? 'action action-danger' : 'action',
                onclick: () => {
                  fermer();
                  a.faire();
                },
              },
              ic(a.icone),
              el('span', {}, a.libelle)
            )
      )
    );
    fermer = ouvrirFeuille(titre, liste);
  }

  function barre(titre, { retour, actions = [], sousTitre } = {}) {
    return el(
      'header',
      { class: 'barre' },
      retour
        ? el('button', { class: 'btn-rond', 'aria-label': 'Retour', onclick: retour }, ic('retour'))
        : el('img', { class: 'marque', src: 'icones/parent.svg', alt: '' }),
      el('div', { class: 'barre-titres' }, el('h1', {}, titre), sousTitre && el('p', {}, sousTitre)),
      el('div', { class: 'barre-actions' }, actions)
    );
  }

  function boutonMenu(libelle, action) {
    return el('button', { class: 'btn-rond', 'aria-label': libelle, onclick: action }, ic('menu'));
  }

  // ---------- Cartes (Leaflet + OpenStreetMap) ----------

  let cartes = [];
  function oublierCartes() {
    cartes.forEach((c) => c.remove());
    cartes = [];
  }

  function fondDeCarte(carte) {
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(carte);
  }

  function repere(texte, classe = '') {
    return L.divIcon({ className: `repere ${classe}`, html: `<span>${texte}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] });
  }

  // Aperçu du parcours : les étapes numérotées reliées par un pointillé.
  function dessinerApercu(zone, etapes) {
    if (typeof L === 'undefined' || !zone.isConnected) return;
    const carte = L.map(zone, { zoomControl: false, attributionControl: true, dragging: false, touchZoom: false, doubleClickZoom: false, scrollWheelZoom: false, boxZoom: false, keyboard: false, tap: false });
    cartes.push(carte);
    fondDeCarte(carte);
    const points = etapes.map((e) => [e.lat, e.lng]);
    L.polyline(points, { color: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#0e5a6b', weight: 3, dashArray: '2 8', lineCap: 'round' }).addTo(carte);
    etapes.forEach((e, i) => L.marker([e.lat, e.lng], { icon: repere(i + 1, e.photo ? '' : 'repere-vide'), keyboard: false, interactive: false }).addTo(carte));
    if (points.length === 1) carte.setView(points[0], 16);
    else carte.fitBounds(points, { padding: [28, 28] });
  }

  // ---------- Installation sur le téléphone ----------

  let invitationInstall = null;
  const estInstallee = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const estIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const CLE_INSTALL_MASQUEE = 'capitaine:install-masquee';

  function installMasquee() {
    try {
      return localStorage.getItem(CLE_INSTALL_MASQUEE) === '1';
    } catch (e) {
      return false;
    }
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    invitationInstall = e;
    if (vueActuelle === vueAccueil) vueAccueil();
  });
  window.addEventListener('appinstalled', () => {
    invitationInstall = null;
    toast('Application installée sur ce téléphone.');
    if (vueActuelle === vueAccueil) vueAccueil();
  });

  async function installer() {
    if (invitationInstall) {
      invitationInstall.prompt();
      const choix = await invitationInstall.userChoice.catch(() => null);
      invitationInstall = null;
      if (choix && choix.outcome === 'accepted') return;
      vueAccueil();
      return;
    }
    const etapes = estIos
      ? [
          ['partager', 'Dans Safari, touche le bouton Partager en bas de l’écran.'],
          ['plus', 'Choisis « Sur l’écran d’accueil », puis « Ajouter ».'],
          ['installer', 'Ouvre ensuite « Capitaine » depuis l’écran d’accueil.'],
        ]
      : [
          ['menu', 'Ouvre le menu du navigateur (les trois points en haut à droite).'],
          ['installer', 'Choisis « Installer l’application » ou « Ajouter à l’écran d’accueil ».'],
          ['plus', 'Ouvre ensuite « Capitaine » depuis l’écran d’accueil.'],
        ];
    ouvrirFeuille(
      'Installer l’application',
      el('ol', { class: 'etapes-install' }, etapes.map(([i, t]) => el('li', {}, ic(i), el('span', {}, t)))),
      estIos &&
        el(
          'p',
          { class: 'note' },
          'Sur iPhone, l’application installée garde ses propres données. Si tu as déjà préparé des parcours dans Safari, sauvegarde-les dans un fichier (menu d’un parcours) puis importe-les dans l’application.'
        )
    );
  }

  function carteInstallation() {
    if (estInstallee() || installMasquee() || (!invitationInstall && !estIos)) return null;
    const carte = el(
      'section',
      { class: 'carte-install' },
      el('img', { src: 'icones/parent.svg', alt: '', class: 'carte-install-icone' }),
      el('div', { class: 'carte-install-texte' }, el('h2', {}, 'Installer Capitaine'), el('p', {}, 'Une vraie application sur ton écran d’accueil, utilisable même sans réseau.')),
      el(
        'div',
        { class: 'carte-install-boutons' },
        el(
          'button',
          {
            class: 'btn btn-discret btn-petit',
            onclick: () => {
              try {
                localStorage.setItem(CLE_INSTALL_MASQUEE, '1');
              } catch (e) {}
              carte.remove();
            },
          },
          'Plus tard'
        ),
        el('button', { class: 'btn btn-principal btn-petit', onclick: installer }, 'Installer')
      )
    );
    return carte;
  }

  // ---------- Écran : liste des parcours ----------

  function partieEnCours(p) {
    return p.partie && !p.partie.cloturee && p.etapes.length > 0;
  }

  function texteAvancement(p) {
    const partie = p.partie;
    if (partie.terminee || partie.fin) return 'Étape finale';
    const i = Math.max(0, p.etapes.findIndex((e) => e.id === partie.courante));
    return `Étape ${i + 1} sur ${p.etapes.length}`;
  }

  function couverture(p, classe) {
    const photo = p.etapes.find((e) => e.photo);
    return photo
      ? el('span', { class: classe, style: `background-image:url(${photo.photo})` })
      : el('span', { class: `${classe} couverture-vide` }, ic('carte'));
  }

  async function vueAccueil() {
    vueActuelle = vueAccueil;
    const tous = (await Stockage.lister()).sort((a, b) => b.modifieLe - a.modifieLe);
    const contenu = el('main', { class: 'page page-accueil' });

    if (!stockageOk) {
      contenu.append(
        el(
          'p',
          { class: 'alerte' },
          "Ce navigateur n'autorise pas la sauvegarde : tes parcours seront perdus en fermant la page. Ouvre l'application dans Chrome ou Safari (hors navigation privée)."
        )
      );
    }

    contenu.append(carteInstallation() || '');

    const enCours = tous.find(partieEnCours);
    if (enCours) {
      contenu.append(
        el(
          'button',
          { class: 'carte-en-cours', onclick: () => ouvrirParcours(enCours.id, true) },
          el('span', { class: 'en-cours-icone' }, ic('jouer')),
          el('span', { class: 'en-cours-texte' }, el('span', { class: 'en-cours-label' }, 'Chasse en cours'), el('span', { class: 'en-cours-nom' }, enCours.nom), el('span', { class: 'en-cours-etape' }, texteAvancement(enCours))),
          el('span', { class: 'en-cours-action' }, 'Reprendre')
        )
      );
    }

    if (tous.length === 0) {
      contenu.append(
        el(
          'section',
          { class: 'accueil-vide' },
          el('img', { src: 'icones/parent.svg', alt: '' }),
          el('h2', {}, 'Prépare ta première chasse'),
          el('p', {}, 'Choisis des lieux, prends la photo que les enfants devront reproduire, et l’application génère les QR codes.'),
          el('button', { class: 'btn btn-principal btn-large', onclick: creerParcours }, ic('plus'), 'Nouveau parcours'),
          el('button', { class: 'btn btn-discret', onclick: chargerExemple }, 'Essayer avec un exemple')
        )
      );
    } else {
      contenu.append(el('div', { class: 'section-entete' }, el('h2', {}, 'Mes parcours'), el('span', { class: 'compteur' }, String(tous.length))));
      const liste = el('ul', { class: 'liste-parcours' });
      for (const p of tous) {
        const nbPhotos = p.etapes.filter((e) => e.photo).length;
        const pret = p.etapes.length > 0 && nbPhotos === p.etapes.length;
        const longueur = longueurParcours(p.etapes);
        liste.append(
          el(
            'li',
            {},
            el(
              'button',
              { class: 'carte-parcours', onclick: () => ouvrirParcours(p.id) },
              couverture(p, 'couverture'),
              el(
                'span',
                { class: 'carte-corps' },
                el('span', { class: 'carte-titre' }, p.nom),
                el('span', { class: 'carte-infos' }, [pluriel(p.etapes.length, 'étape'), longueur > 0 && texteDistance(longueur), `modifié le ${dateCourte(p.modifieLe)}`].filter(Boolean).join(' · ')),
                el(
                  'span',
                  { class: 'carte-etat' },
                  partieEnCours(p)
                    ? el('span', { class: 'pastille pastille-accent' }, 'En cours')
                    : el('span', { class: pret ? 'pastille pastille-ok' : 'pastille pastille-attention' }, pret ? 'Prêt' : p.etapes.length ? `${nbPhotos}/${p.etapes.length} photos` : 'À compléter')
                )
              ),
              ic('chevron', 'ic chevron')
            )
          )
        );
      }
      contenu.append(liste);
    }

    const aExemple = tous.some((p) => p.nom === EXEMPLE_NOISY.nom);
    const champImport = el('input', { id: 'import-fichier', type: 'file', accept: '.json,application/json', hidden: true, onchange: importerParcours });
    const menu = boutonMenu('Plus d’options', () =>
      menuActions('Options', [
        { icone: 'importer', libelle: 'Importer un parcours sauvegardé', pour: 'import-fichier' },
        !aExemple && { icone: 'carte', libelle: 'Charger l’exemple Noisy-le-Grand', faire: chargerExemple },
        !estInstallee() && { icone: 'installer', libelle: 'Installer l’application', faire: installer },
      ])
    );

    afficher(
      barre('Capitaine', { sousTitre: 'Chasses au trésor', actions: [menu] }),
      contenu,
      champImport,
      tous.length > 0 && el('button', { class: 'fab', onclick: creerParcours }, ic('plus'), 'Nouveau parcours')
    );
  }

  async function creerParcours() {
    const nom = await demanderTexte({ titre: 'Nom du parcours', placeholder: 'Ex. : Tour à vélo bords de Marne', bouton: 'Créer' });
    if (!nom) return;
    const now = Date.now();
    const p = { id: Stockage.nouvelId(), nom, creeLe: now, modifieLe: now, etapes: [] };
    await Stockage.enregistrer(p);
    ouvrirParcours(p.id);
  }

  async function chargerExemple() {
    const now = Date.now();
    const p = {
      id: Stockage.nouvelId(),
      nom: EXEMPLE_NOISY.nom,
      creeLe: now,
      modifieLe: now,
      etapes: EXEMPLE_NOISY.etapes.map(([nom, lat, lng]) => ({ id: Stockage.nouvelId(), nom, lat, lng, photo: null })),
    };
    await Stockage.enregistrer(p);
    toast('Exemple chargé. Il reste à ajouter les photos.');
    ouvrirParcours(p.id);
  }

  async function importerParcours(evt) {
    const fichier = evt.target.files && evt.target.files[0];
    evt.target.value = '';
    if (!fichier) return;
    try {
      const donnees = JSON.parse(await fichier.text());
      if (!donnees || typeof donnees.nom !== 'string' || !Array.isArray(donnees.etapes)) throw new Error();
      const now = Date.now();
      const p = {
        id: Stockage.nouvelId(),
        nom: donnees.nom,
        creeLe: now,
        modifieLe: now,
        etapes: donnees.etapes
          .filter((e) => e && isFinite(e.lat) && isFinite(e.lng))
          .map((e) => ({
            id: Stockage.nouvelId(),
            nom: String(e.nom || 'Étape'),
            lat: Number(e.lat),
            lng: Number(e.lng),
            photo: typeof e.photo === 'string' && e.photo.startsWith('data:image/') ? e.photo : null,
          })),
      };
      await Stockage.enregistrer(p);
      toast(`« ${p.nom} » importé.`);
      ouvrirParcours(p.id);
    } catch (e) {
      toast("Ce fichier n'est pas un parcours sauvegardé depuis l'application.");
    }
  }

  // ---------- Écran : un parcours ----------

  let parcoursCourant = null;
  let modeTri = false;

  async function ouvrirParcours(id, reprendre = false) {
    parcoursCourant = await Stockage.lire(id);
    modeTri = false;
    if (!parcoursCourant) return vueAccueil();
    if (reprendre && partieValide(parcoursCourant)) return vueJeu();
    vueParcours();
    window.scrollTo(0, 0);
  }

  async function sauver() {
    await Stockage.enregistrer(parcoursCourant);
  }

  function vueParcours() {
    vueActuelle = vueParcours;
    const p = parcoursCourant;
    const contenu = el('main', { class: 'page' });
    const nbPhotos = p.etapes.filter((e) => e.photo).length;
    const manquantes = p.etapes.length - nbPhotos;
    const longueur = longueurParcours(p.etapes);

    let zoneCarte = null;
    if (p.etapes.length > 0) {
      zoneCarte = el('div', { class: 'apercu-carte', role: 'img', 'aria-label': 'Carte du parcours' });
      contenu.append(zoneCarte);
    }

    contenu.append(
      el(
        'div',
        { class: 'stats' },
        el('div', { class: 'stat' }, el('span', { class: 'stat-valeur' }, String(p.etapes.length)), el('span', { class: 'stat-label' }, p.etapes.length > 1 ? 'étapes' : 'étape')),
        el('div', { class: 'stat' }, el('span', { class: 'stat-valeur' }, longueur ? texteDistance(longueur) : '–'), el('span', { class: 'stat-label' }, 'à vol d’oiseau')),
        el('div', { class: manquantes ? 'stat stat-attention' : 'stat' }, el('span', { class: 'stat-valeur' }, `${nbPhotos}/${p.etapes.length}`), el('span', { class: 'stat-label' }, 'photos'))
      )
    );

    if (p.etapes.length > 0) {
      const partie = partieValide(p);
      contenu.append(
        partie && !partie.cloturee
          ? el(
              'div',
              { class: 'pile-boutons' },
              el('button', { class: 'btn btn-jeu btn-large', onclick: () => vueJeu() }, ic('jouer'), `Reprendre la chasse · ${partie.terminee || partie.fin ? 'étape finale' : `étape ${indexCourant(p, partie) + 1}`}`),
              el('button', { class: 'btn btn-discret', onclick: recommencerPartie }, 'Recommencer depuis le début')
            )
          : el('button', { class: 'btn btn-jeu btn-large', onclick: nouvellePartie }, ic('jouer'), 'Lancer la chasse')
      );
      if (manquantes > 0) {
        contenu.append(
          el('p', { class: 'conseil' }, ic('ampoule'), el('span', {}, `${pluriel(manquantes, 'étape')} sans photo. Touche le carré « Photo » d’une étape pour prendre ou choisir la photo à reproduire.`))
        );
      }
    }

    contenu.append(
      el(
        'div',
        { class: 'section-entete' },
        el('h2', {}, 'Étapes'),
        p.etapes.length > 1 &&
          el(
            'button',
            { class: modeTri ? 'btn btn-petit btn-principal' : 'btn btn-petit btn-discret', 'aria-pressed': String(modeTri), onclick: () => ((modeTri = !modeTri), vueParcours()) },
            modeTri ? ic('valider') : ic('trier'),
            modeTri ? 'Terminé' : 'Réordonner'
          ),
        p.etapes.length > 0 && !modeTri && el('button', { class: 'btn btn-petit btn-discret', onclick: () => afficherQr(0) }, ic('qr'), 'QR codes')
      )
    );

    if (p.etapes.length === 0) {
      contenu.append(
        el(
          'div',
          { class: 'etapes-vide' },
          ic('lieu', 'ic ic-grand'),
          el('p', {}, 'Ajoute la première étape : un lieu, sa position sur la carte et la photo que les enfants devront reproduire.')
        )
      );
    }

    const liste = el('ol', { class: modeTri ? 'frise frise-tri' : 'frise' });
    p.etapes.forEach((etape, index) => {
      const precedente = p.etapes[index - 1];
      const infos = precedente ? `à ${texteDistance(distanceMetres(precedente, etape))} de l’étape ${index}` : 'Départ';
      liste.append(
        el(
          'li',
          { class: 'etape' },
          el('span', { class: 'numero' }, String(index + 1)),
          el(
            'div',
            { class: 'etape-carte' },
            boutonPhotoEtape(etape, index),
            el(
              'button',
              { class: 'etape-texte', onclick: () => vueEtape(etape.id), disabled: modeTri, 'aria-label': `Modifier l'étape ${index + 1} : ${etape.nom}` },
              el('span', { class: 'etape-nom' }, etape.nom),
              el('span', { class: 'etape-infos' }, infos)
            ),
            modeTri
              ? el(
                  'div',
                  { class: 'fleches' },
                  el('button', { class: 'btn-rond btn-rond-cadre', disabled: index === 0, 'aria-label': 'Monter', onclick: () => deplacer(index, -1) }, ic('haut')),
                  el('button', { class: 'btn-rond btn-rond-cadre', disabled: index === p.etapes.length - 1, 'aria-label': 'Descendre', onclick: () => deplacer(index, 1) }, ic('bas'))
                )
              : el('button', { class: 'btn-rond', onclick: () => afficherQr(index), 'aria-label': `QR code de l'étape ${index + 1}` }, ic('qr'))
          )
        )
      );
    });
    if (p.etapes.length > 0) {
      liste.append(
        el(
          'li',
          { class: 'etape etape-fin' },
          el('span', { class: 'numero numero-fin', 'aria-hidden': 'true' }, ic('etoile')),
          el(
            'div',
            { class: 'etape-carte' },
            el('span', { class: 'vignette vignette-fin', 'aria-hidden': 'true' }, ic('drapeau')),
            el('div', { class: 'etape-texte' }, el('span', { class: 'etape-nom' }, 'Fin de la chasse'), el('span', { class: 'etape-infos' }, 'QR code final, toujours en dernier')),
            !modeTri && el('button', { class: 'btn-rond', onclick: () => afficherQr(p.etapes.length), 'aria-label': 'QR code de la fin de la chasse' }, ic('qr'))
          )
        )
      );
    }
    contenu.append(liste);

    if (!modeTri) contenu.append(el('button', { class: 'btn btn-ajout', onclick: () => vueEtape(null) }, ic('plus'), 'Ajouter une étape'));

    const menu = boutonMenu('Actions du parcours', () =>
      menuActions(p.nom, [
        { icone: 'crayon', libelle: 'Renommer', faire: renommerParcours },
        { icone: 'copier', libelle: 'Dupliquer pour en faire un nouveau', faire: dupliquerParcours },
        { icone: 'telecharger', libelle: 'Sauvegarder dans un fichier', faire: exporterParcours },
        { icone: 'poubelle', libelle: 'Supprimer ce parcours', faire: supprimerParcours, danger: true },
      ])
    );

    afficher(barre(p.nom, { retour: vueAccueil, actions: [menu] }), contenu);
    if (zoneCarte) requestAnimationFrame(() => dessinerApercu(zoneCarte, p.etapes));
  }

  // Vignette touchable : ouvre directement l'appareil photo ou la galerie.
  function boutonPhotoEtape(etape, index) {
    const idChamp = `photo-${etape.id}`;
    const champ = el('input', {
      id: idChamp,
      type: 'file',
      accept: 'image/*',
      hidden: true,
      onchange: async (e) => {
        const fichier = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!fichier) return;
        try {
          etape.photo = await preparerPhoto(fichier);
          await sauver();
          toast(`Photo ajoutée à l'étape ${index + 1}.`);
          vueParcours();
        } catch (err) {
          toast(err.message);
        }
      },
    });
    const libelle = etape.photo ? `Changer la photo de l'étape ${index + 1}` : `Ajouter une photo à l'étape ${index + 1}`;
    return el(
      'label',
      { class: etape.photo ? 'photo-etape' : 'photo-etape photo-etape-vide', for: idChamp, 'aria-label': libelle, title: libelle },
      etape.photo ? el('img', { class: 'vignette', src: etape.photo, alt: '' }) : el('span', { class: 'vignette vignette-vide' }, ic('photo'), 'Photo'),
      champ
    );
  }

  async function deplacer(index, sens) {
    const etapes = parcoursCourant.etapes;
    const cible = index + sens;
    if (cible < 0 || cible >= etapes.length) return;
    [etapes[index], etapes[cible]] = [etapes[cible], etapes[index]];
    await sauver();
    vueParcours();
  }

  async function renommerParcours() {
    const nom = await demanderTexte({ titre: 'Renommer le parcours', valeur: parcoursCourant.nom });
    if (!nom) return;
    parcoursCourant.nom = nom;
    await sauver();
    vueParcours();
  }

  async function dupliquerParcours() {
    const nom = await demanderTexte({ titre: 'Nom de la copie', valeur: `${parcoursCourant.nom} (copie)`, bouton: 'Dupliquer' });
    if (!nom) return;
    const copie = Stockage.cloner(parcoursCourant);
    const now = Date.now();
    Object.assign(copie, { id: Stockage.nouvelId(), nom, creeLe: now });
    delete copie.partie;
    copie.etapes.forEach((e) => (e.id = Stockage.nouvelId()));
    await Stockage.enregistrer(copie);
    toast('Copie créée.');
    ouvrirParcours(copie.id);
  }

  function exporterParcours() {
    const p = parcoursCourant;
    const donnees = { format: 'chasse-au-tresor', version: 1, nom: p.nom, etapes: p.etapes.map(({ nom, lat, lng, photo }) => ({ nom, lat, lng, photo })) };
    const blob = new Blob([JSON.stringify(donnees)], { type: 'application/json' });
    const lien = el('a', { href: URL.createObjectURL(blob), download: `${p.nom.replace(/[^\w\-À-ÿ ]+/g, '').trim() || 'parcours'}.json` });
    document.body.append(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(lien.href), 5000);
    toast('Fichier de sauvegarde créé.');
  }

  async function supprimerParcours() {
    const ok = await confirmer({ titre: `Supprimer « ${parcoursCourant.nom} » ?`, texte: 'Le parcours, ses étapes et ses photos seront effacés de ce téléphone.' });
    if (!ok) return;
    await Stockage.supprimer(parcoursCourant.id);
    parcoursCourant = null;
    toast('Parcours supprimé.');
    vueAccueil();
  }

  // ---------- Écran : ajouter ou modifier une étape ----------

  function vueEtape(etapeId) {
    vueActuelle = null;
    const p = parcoursCourant;
    const index = etapeId ? p.etapes.findIndex((e) => e.id === etapeId) : -1;
    const existante = index >= 0 ? p.etapes[index] : null;
    const brouillon = existante ? { ...existante } : { id: Stockage.nouvelId(), nom: '', lat: null, lng: null, photo: null };
    const total = existante ? p.etapes.length : p.etapes.length + 1;
    const positionInitiale = existante ? index + 1 : total;

    const champNom = el('input', { id: 'etape-nom', type: 'text', value: brouillon.nom, placeholder: 'Ex. : La grande fontaine', autocomplete: 'off', required: true });
    const champCoords = el('input', {
      id: 'etape-coords',
      type: 'text',
      inputmode: 'text',
      value: brouillon.lat !== null ? texteCoords(brouillon) : '',
      placeholder: '48.8459, 2.5534 ou lien Google Maps',
      autocomplete: 'off',
    });
    const aideCoords = el('p', { class: 'aide', id: 'aide-coords' });

    // Carte : toucher un endroit place l'étape ; le repère se déplace au doigt.
    const zoneCarte = el('div', { class: 'carte-choix', role: 'application', 'aria-label': 'Carte : touche un endroit pour y placer l’étape' });
    let carte = null;
    let marqueur = null;
    let cercle = null;
    function placerSurCarte(recentrer) {
      if (!carte) return;
      if (brouillon.lat === null) {
        if (marqueur) {
          marqueur.remove();
          cercle.remove();
        }
        marqueur = cercle = null;
        return;
      }
      const pt = [brouillon.lat, brouillon.lng];
      if (!marqueur) {
        cercle = L.circle(pt, { radius: RAYON_METRES, color: '#0e5a6b', weight: 1.5, fillOpacity: 0.12, interactive: false }).addTo(carte);
        marqueur = L.marker(pt, { draggable: true, icon: repere(existante ? index + 1 : positionInitiale, 'repere-actif'), autoPan: true }).addTo(carte);
        marqueur.on('drag', () => cercle.setLatLng(marqueur.getLatLng()));
        marqueur.on('dragend', () => poser(marqueur.getLatLng(), false));
      } else {
        marqueur.setLatLng(pt);
        cercle.setLatLng(pt);
      }
      if (recentrer) carte.setView(pt, Math.max(carte.getZoom(), 17));
    }
    function poser(latlng, recentrer) {
      champCoords.value = `${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;
      majCoords(recentrer);
    }
    function creerCarteChoix() {
      if (typeof L === 'undefined' || !zoneCarte.isConnected) return;
      carte = L.map(zoneCarte, { zoomControl: true, attributionControl: true, tap: false });
      cartes.push(carte);
      fondDeCarte(carte);
      const autres = p.etapes.filter((e) => e.id !== brouillon.id);
      autres.forEach((e) => L.marker([e.lat, e.lng], { icon: repere(p.etapes.indexOf(e) + 1, 'repere-autre'), interactive: false, keyboard: false }).addTo(carte));
      if (brouillon.lat !== null) carte.setView([brouillon.lat, brouillon.lng], 17);
      else if (autres.length) carte.setView([autres[autres.length - 1].lat, autres[autres.length - 1].lng], 16);
      else carte.setView([46.6, 2.4], 5);
      carte.on('click', (e) => poser(e.latlng, false));
      placerSurCarte(false);
    }

    function majCoords(recentrer = true) {
      const c = lireCoords(champCoords.value);
      champCoords.classList.toggle('invalide', !!champCoords.value.trim() && !c);
      if (c) {
        brouillon.lat = c.lat;
        brouillon.lng = c.lng;
        aideCoords.textContent = `Les enfants devront arriver à moins de ${RAYON_METRES} m de ce point (le cercle sur la carte).`;
      } else {
        brouillon.lat = brouillon.lng = null;
        aideCoords.textContent = champCoords.value.trim()
          ? 'Position non reconnue. Écris la latitude puis la longitude, par exemple 48.8459, 2.5534.'
          : 'Touche la carte à l’endroit voulu, utilise ta position, ou colle des coordonnées ou un lien Google Maps ci-dessous.';
      }
      placerSurCarte(recentrer);
    }
    champCoords.addEventListener('input', () => majCoords(true));

    const boutonPosition = el('button', { type: 'button', class: 'btn btn-petit', onclick: utiliserMaPosition }, ic('viser'), 'Ma position');
    function utiliserMaPosition() {
      if (!navigator.geolocation) {
        toast("Ce téléphone ne donne pas accès à la position.");
        return;
      }
      boutonPosition.disabled = true;
      boutonPosition.lastChild.textContent = 'Recherche…';
      const fin = () => {
        boutonPosition.disabled = false;
        boutonPosition.lastChild.textContent = 'Ma position';
      };
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fin();
          poser({ lat: pos.coords.latitude, lng: pos.coords.longitude }, true);
          toast(`Position trouvée (précision ± ${Math.round(pos.coords.accuracy)} m).`);
        },
        (err) => {
          fin();
          toast(err.code === 1 ? "L'accès à la position a été refusé. Autorise-le dans les réglages du navigateur." : "Position introuvable pour l'instant. Réessaie à l'extérieur.");
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
    }

    const apercu = el('div', { class: 'apercu-photo' });
    function majApercu() {
      apercu.replaceChildren(
        brouillon.photo
          ? el('img', { src: brouillon.photo, alt: 'Photo modèle' })
          : el('label', { class: 'apercu-vide', for: 'etape-photo' }, ic('image', 'ic ic-grand'), el('span', {}, 'Ajouter la photo à reproduire'))
      );
      boutonPhoto.lastChild.textContent = brouillon.photo ? 'Changer' : 'Ajouter';
      boutonRetirer.hidden = !brouillon.photo;
    }
    const champPhoto = el('input', {
      id: 'etape-photo',
      type: 'file',
      accept: 'image/*',
      hidden: true,
      onchange: async (e) => {
        const fichier = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!fichier) return;
        try {
          brouillon.photo = await preparerPhoto(fichier);
          majApercu();
        } catch (err) {
          toast(err.message);
        }
      },
    });
    const boutonPhoto = el('label', { class: 'btn btn-petit', for: 'etape-photo' }, ic('photo'), el('span', {}, 'Ajouter'));
    const boutonRetirer = el('button', { type: 'button', class: 'btn btn-petit btn-danger-texte', onclick: () => ((brouillon.photo = null), majApercu()) }, 'Retirer');

    const choixOrdre = el('select', { id: 'etape-ordre' });
    for (let i = 1; i <= total; i++) {
      choixOrdre.append(el('option', { value: i, selected: i === positionInitiale }, `Étape ${i}${i === total && !existante ? ' (à la fin)' : ''}`));
    }

    const formulaire = el(
      'form',
      { class: 'page formulaire page-avec-pied', onsubmit: (e) => (e.preventDefault(), enregistrerEtape()) },
      el('section', { class: 'bloc' }, el('label', { class: 'bloc-titre', for: 'etape-nom' }, 'Nom du lieu'), champNom),
      el(
        'section',
        { class: 'bloc' },
        el('div', { class: 'bloc-entete' }, el('span', { class: 'bloc-titre' }, 'Emplacement'), boutonPosition),
        zoneCarte,
        aideCoords,
        el('details', { class: 'saisie-coords' }, el('summary', {}, 'Saisir des coordonnées'), el('label', { class: 'visuel-cache', for: 'etape-coords' }, 'Coordonnées GPS'), champCoords)
      ),
      el(
        'section',
        { class: 'bloc' },
        el('div', { class: 'bloc-entete' }, el('span', { class: 'bloc-titre' }, 'Photo à reproduire'), el('div', { class: 'rangee' }, boutonRetirer, boutonPhoto)),
        apercu,
        champPhoto
      ),
      el('section', { class: 'bloc' }, el('label', { class: 'bloc-titre', for: 'etape-ordre' }, 'Place dans le parcours'), choixOrdre),
      existante && el('button', { type: 'button', class: 'btn btn-discret btn-danger-texte', onclick: supprimerEtape }, ic('poubelle'), 'Supprimer cette étape'),
      el('footer', { class: 'pied-action' }, el('button', { type: 'submit', class: 'btn btn-principal btn-large' }, existante ? 'Enregistrer' : "Ajouter l'étape"))
    );

    async function enregistrerEtape() {
      brouillon.nom = champNom.value.trim();
      if (!brouillon.nom) {
        toast('Donne un nom à ce lieu.');
        champNom.focus();
        return;
      }
      if (brouillon.lat === null) {
        toast('Place l’étape sur la carte.');
        zoneCarte.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
      const etapes = p.etapes.filter((e) => e.id !== brouillon.id);
      const place = Math.min(Math.max(parseInt(choixOrdre.value, 10) - 1, 0), etapes.length);
      etapes.splice(place, 0, brouillon);
      p.etapes = etapes;
      await sauver();
      toast(existante ? 'Étape enregistrée.' : 'Étape ajoutée.');
      vueParcours();
    }

    async function supprimerEtape() {
      const ok = await confirmer({ titre: `Supprimer « ${existante.nom} » ?`, texte: 'Cette étape et sa photo seront retirées du parcours.' });
      if (!ok) return;
      p.etapes = p.etapes.filter((e) => e.id !== existante.id);
      await sauver();
      toast('Étape supprimée.');
      vueParcours();
    }

    majCoords(false);
    majApercu();
    afficher(barre(existante ? `Étape ${index + 1}` : 'Nouvelle étape', { retour: vueParcours, sousTitre: p.nom }), formulaire);
    requestAnimationFrame(creerCarteChoix);
    window.scrollTo(0, 0);
  }

  // ---------- Mode pilote : la chasse en cours ----------
  // La partie est enregistrée dans le parcours (champ `partie`) pour
  // survivre à un rechargement de la page ou à un téléphone qui se verrouille.
  // partie = { courante: idEtape, indice: photo affichée ?, validees: [idEtape], historique: [{ validee }], terminee }

  // Nettoie la partie si des étapes ont été supprimées entre-temps.
  function partieValide(p) {
    const partie = p.partie;
    if (!partie || p.etapes.length === 0) return null;
    const ids = new Set(p.etapes.map((e) => e.id));
    partie.validees = partie.validees.filter((id) => ids.has(id));
    partie.historique = partie.historique.filter((h) => ids.has(h.validee));
    if (!ids.has(partie.courante)) {
      const suivante = prochaineAFaire(p, partie, -1);
      if (suivante) {
        partie.courante = suivante.id;
        partie.indice = false;
      } else partie.terminee = true;
    }
    return partie;
  }

  function indexCourant(p, partie) {
    return Math.max(0, p.etapes.findIndex((e) => e.id === partie.courante));
  }

  // Première étape non validée après `depuisIndex`, sinon depuis le début.
  function prochaineAFaire(p, partie, depuisIndex) {
    const faites = new Set(partie.validees);
    const apres = p.etapes.slice(depuisIndex + 1).find((e) => !faites.has(e.id));
    return apres || p.etapes.find((e) => !faites.has(e.id)) || null;
  }

  async function nouvellePartie() {
    parcoursCourant.partie = { courante: parcoursCourant.etapes[0].id, validees: [], historique: [], terminee: false, indice: false, fin: false, cloturee: false };
    await sauver();
    vueJeu();
  }

  async function recommencerPartie() {
    const ok = await confirmer({ titre: 'Recommencer la chasse ?', texte: 'Les étapes déjà validées repasseront à faire.', bouton: 'Recommencer', danger: false });
    if (ok) nouvellePartie();
  }

  // Garde l'écran allumé pendant la chasse, quand le téléphone le permet.
  let verrouEcran = null;
  async function garderEcranAllume() {
    try {
      if ('wakeLock' in navigator && document.visibilityState === 'visible' && !verrouEcran) {
        verrouEcran = await navigator.wakeLock.request('screen');
        verrouEcran.addEventListener('release', () => (verrouEcran = null));
      }
    } catch (e) {
      verrouEcran = null;
    }
  }
  function libererEcran() {
    if (verrouEcran) verrouEcran.release().catch(() => {});
    verrouEcran = null;
  }
  let enJeu = false;
  document.addEventListener('visibilitychange', () => enJeu && garderEcranAllume());

  function quitterJeu() {
    enJeu = false;
    libererEcran();
    vueParcours();
  }

  // Barre de progression : une case par étape, plus l'étape finale.
  function progression(p, partie) {
    const faites = new Set(partie.validees);
    const finCourante = partie.terminee || partie.fin;
    return el(
      'div',
      { class: 'progression', 'aria-hidden': 'true' },
      p.etapes.map((e) => el('span', { class: faites.has(e.id) ? 'case case-faite' : !finCourante && e.id === partie.courante ? 'case case-courante' : 'case' })),
      el('span', { class: partie.cloturee ? 'case case-fin case-faite' : finCourante ? 'case case-fin case-courante' : 'case case-fin' })
    );
  }

  function vueJeu() {
    vueActuelle = vueJeu;
    const p = parcoursCourant;
    const partie = partieValide(p);
    if (!partie) return vueParcours();
    enJeu = true;
    garderEcranAllume();

    const total = p.etapes.length;
    const nbValidees = partie.validees.length;
    const boutonEtapes = el('button', { class: 'btn-rond', 'aria-label': 'Toutes les étapes', onclick: afficherMenuEtapes }, ic('liste'));
    const entetePartie = (...contenu) => el('div', { class: 'jeu-entete' }, progression(p, partie), ...contenu);
    const boutonAnnuler = el(
      'button',
      { class: 'btn', disabled: partie.historique.length === 0, onclick: annulerValidation },
      ic('annuler'),
      'Annuler'
    );

    const texteValidees = `${pluriel(nbValidees, 'étape')} validée${nbValidees > 1 ? 's' : ''} sur ${total}`;

    if (partie.cloturee) {
      const bilan = el(
        'main',
        { class: 'page page-jeu' },
        el(
          'div',
          { class: 'fin' },
          progression(p, partie),
          el('span', { class: 'fin-icone', 'aria-hidden': 'true' }, ic('etoile')),
          el('h2', {}, 'Chasse terminée !'),
          el('p', {}, `${texteValidees}.`)
        ),
        el(
          'div',
          { class: 'pile-boutons' },
          el('button', { class: 'btn btn-principal btn-large', onclick: quitterJeu }, 'Retour au parcours'),
          el('button', { class: 'btn', onclick: () => changerFin({ cloturee: false }) }, ic('qr'), 'Revoir le QR code final'),
          el('button', { class: 'btn btn-discret', onclick: recommencerPartie }, 'Recommencer depuis le début')
        )
      );
      afficher(barre(p.nom, { retour: quitterJeu, actions: [boutonEtapes], sousTitre: 'Chasse terminée' }), bilan);
      window.scrollTo(0, 0);
      return;
    }

    // Étape finale : un QR code seul, qui déclenche la célébration chez l'enfant.
    if (partie.terminee || partie.fin) {
      const fin = el(
        'main',
        { class: 'page page-jeu' },
        entetePartie(el('p', { class: 'jeu-progression' }, `Étape finale · ${texteValidees}`), el('h2', {}, 'Fin de la chasse')),
        el('div', { class: 'qr-grand', role: 'img', 'aria-label': 'QR code de la fin de la chasse', html: svgQr(contenuQrFin()) }),
        el('p', { class: 'aide centre' }, 'Fais scanner ce QR code aux enfants : une surprise les attend !')
      );
      afficher(
        barre(p.nom, { retour: quitterJeu, actions: [boutonEtapes], sousTitre: 'Chasse en cours' }),
        fin,
        el('footer', { class: 'barre-jeu' }, boutonAnnuler, el('button', { class: 'btn btn-valider btn-large', onclick: () => changerFin({ cloturee: true }) }, ic('valider'), 'Terminer la chasse'))
      );
      window.scrollTo(0, 0);
      return;
    }

    const index = indexCourant(p, partie);
    const etape = p.etapes[index];
    const dejaValidee = partie.validees.includes(etape.id);

    // Deux temps par étape : d'abord le QR code seul (l'enfant part vers le lieu),
    // puis, une fois sur place, l'indice (la photo à reproduire) et la validation.
    const indice = !!partie.indice;
    const entete = entetePartie(
      el('p', { class: 'jeu-progression' }, `Étape ${index + 1} sur ${total} · ${nbValidees} validée${nbValidees > 1 ? 's' : ''}`),
      el('h2', {}, etape.nom),
      dejaValidee && el('span', { class: 'pastille pastille-ok' }, 'Déjà validée')
    );

    const contenu = indice
      ? el(
          'main',
          { class: 'page page-jeu' },
          entete,
          el(
            'section',
            { class: 'photo-modele' },
            el('h3', { class: 'sous-titre centre' }, ic('image'), 'Indice : la photo à reproduire'),
            etape.photo
              ? el('img', { src: etape.photo, alt: `Photo modèle : ${etape.nom}` })
              : el('p', { class: 'apercu-vide' }, "Pas de photo pour cette étape. Tu peux en ajouter une depuis l'écran du parcours.")
          ),
          el('p', { class: 'aide centre' }, 'Quand la photo de l’enfant ressemble au modèle, valide-la pour afficher le QR code suivant.'),
          el('button', { class: 'btn btn-discret', onclick: () => changerIndice(false) }, ic('qr'), 'Revoir le QR code')
        )
      : el(
          'main',
          { class: 'page page-jeu' },
          entete,
          el('div', { class: 'qr-grand', role: 'img', 'aria-label': `QR code de l'étape ${index + 1}`, html: svgQr(contenuQr(etape)) }),
          el('p', { class: 'aide centre' }, "L'enfant scanne ce QR code pour trouver le lieu. Une fois sur place, touche « Indice »."),
        );

    const boutonAction = dejaValidee
      ? el('button', { class: 'btn btn-principal btn-large', onclick: allerProchaine }, 'Étape suivante', ic('chevron'))
      : indice
        ? el('button', { class: 'btn btn-valider btn-large', onclick: validerPhoto }, ic('valider'), 'Photo validée')
        : el('button', { class: 'btn btn-principal btn-large', onclick: () => changerIndice(true) }, ic('ampoule'), 'Indice');

    afficher(
      barre(p.nom, { retour: quitterJeu, actions: [boutonEtapes], sousTitre: 'Chasse en cours' }),
      contenu,
      el('footer', { class: 'barre-jeu' }, boutonAnnuler, boutonAction)
    );
    window.scrollTo(0, 0);
  }

  async function changerFin(valeurs) {
    Object.assign(parcoursCourant.partie, valeurs);
    await sauver();
    vueJeu();
  }

  async function changerIndice(afficherIndice) {
    parcoursCourant.partie.indice = afficherIndice;
    await sauver();
    vueJeu();
  }

  async function validerPhoto() {
    const p = parcoursCourant;
    const partie = p.partie;
    const index = indexCourant(p, partie);
    const etape = p.etapes[index];
    if (!partie.validees.includes(etape.id)) partie.validees.push(etape.id);
    partie.historique.push({ validee: etape.id });
    const suivante = prochaineAFaire(p, partie, index);
    if (suivante) partie.courante = suivante.id;
    else partie.terminee = true;
    partie.indice = false;
    await sauver();
    toast(suivante ? `Bravo ! Étape ${index + 1} validée.` : 'Dernière étape validée !');
    vueJeu();
  }

  async function allerProchaine() {
    const p = parcoursCourant;
    const suivante = prochaineAFaire(p, p.partie, indexCourant(p, p.partie));
    if (suivante) p.partie.courante = suivante.id;
    else p.partie.terminee = true;
    p.partie.indice = false;
    await sauver();
    vueJeu();
  }

  // Annule la dernière validation et revient sur cette étape.
  async function annulerValidation() {
    const p = parcoursCourant;
    const partie = p.partie;
    const derniere = partie.historique.pop();
    if (!derniere) return;
    partie.validees = partie.validees.filter((id) => id !== derniere.validee);
    partie.courante = derniere.validee;
    partie.terminee = false;
    partie.fin = false;
    partie.cloturee = false;
    partie.indice = true;
    await sauver();
    const numero = p.etapes.findIndex((e) => e.id === derniere.validee) + 1;
    toast(`Validation annulée : retour à l'étape ${numero}.`);
    vueJeu();
  }

  // Menu récapitulatif : afficher directement le QR code de n'importe quelle étape.
  function afficherMenuEtapes() {
    const p = parcoursCourant;
    const partie = p.partie;
    const faites = new Set(partie.validees);
    let fermer = () => {};
    const liste = el('ol', { class: 'menu-etapes' });
    p.etapes.forEach((etape, index) => {
      const courante = !partie.terminee && !partie.fin && etape.id === partie.courante;
      const statut = faites.has(etape.id) ? ['Validée', 'pastille-ok'] : courante ? ['En cours', 'pastille-attention'] : ['À faire', 'pastille-neutre'];
      liste.append(
        el(
          'li',
          {},
          el(
            'button',
            {
              class: courante ? 'menu-etape menu-etape-courante' : 'menu-etape',
              onclick: async () => {
                partie.courante = etape.id;
                partie.terminee = false;
                partie.fin = false;
                partie.cloturee = false;
                partie.indice = false;
                await sauver();
                fermer();
                vueJeu();
              },
            },
            el('span', { class: 'numero' }, String(index + 1)),
            el('span', { class: 'menu-etape-nom' }, etape.nom),
            el('span', { class: `pastille ${statut[1]}` }, statut[0])
          )
        )
      );
    });
    const finCourante = partie.terminee || partie.fin;
    liste.append(
      el(
        'li',
        {},
        el(
          'button',
          {
            class: finCourante ? 'menu-etape menu-etape-courante' : 'menu-etape',
            onclick: async () => {
              partie.fin = true;
              partie.cloturee = false;
              partie.indice = false;
              await sauver();
              fermer();
              vueJeu();
            },
          },
          el('span', { class: 'numero numero-fin' }, ic('etoile')),
          el('span', { class: 'menu-etape-nom' }, 'Fin de la chasse'),
          el('span', { class: `pastille ${finCourante ? 'pastille-attention' : 'pastille-neutre'}` }, finCourante ? 'En cours' : 'Finale')
        )
      )
    );
    fermer = ouvrirFeuille('Étapes du parcours', el('p', { class: 'aide' }, 'Touche une étape pour afficher son QR code, par exemple pour en sauter une si les enfants sont fatigués.'), liste);
  }

  // ---------- QR code en grand ----------

  function afficherQr(indexDepart) {
    const etapes = parcoursCourant.etapes;
    let index = indexDepart;
    const zone = el('div', { class: 'qr-contenu' });
    const voile = el('div', { class: 'voile voile-qr', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'QR code' }, zone);

    function fermer() {
      document.removeEventListener('keydown', clavier);
      voile.remove();
    }
    function clavier(e) {
      if (e.key === 'Escape') fermer();
      if (e.key === 'ArrowRight') aller(1);
      if (e.key === 'ArrowLeft') aller(-1);
    }
    function aller(sens) {
      const cible = index + sens;
      if (cible >= 0 && cible <= etapes.length) {
        index = cible;
        dessiner();
      }
    }
    function dessiner() {
      const estFin = index === etapes.length;
      const etape = etapes[index];
      zone.replaceChildren(
        el('p', { class: 'qr-etape' }, estFin ? 'Étape finale' : `Étape ${index + 1} sur ${etapes.length}`),
        el('h2', {}, estFin ? 'Fin de la chasse' : etape.nom),
        el('div', { class: 'qr-grand', html: svgQr(estFin ? contenuQrFin() : contenuQr(etape)) }),
        el('p', { class: 'qr-coords' }, estFin ? 'Déclenche la surprise finale' : texteCoords(etape)),
        el(
          'div',
          { class: 'rangee-boutons' },
          el('button', { class: 'btn', disabled: index === 0, onclick: () => aller(-1) }, ic('retour'), 'Précédente'),
          el('button', { class: 'btn', disabled: estFin, onclick: () => aller(1) }, 'Suivante', ic('chevron'))
        ),
        el('button', { class: 'btn btn-principal btn-large', onclick: fermer }, 'Fermer')
      );
    }
    document.addEventListener('keydown', clavier);
    dessiner();
    document.body.append(voile);
  }

  // ---------- Démarrage ----------

  let vueActuelle = null;

  function afficher(...noeuds) {
    oublierCartes();
    app.replaceChildren(...noeuds.filter(Boolean));
  }

  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  let stockageOk = true;
  (async () => {
    stockageOk = await Stockage.disponible();
    if (stockageOk) Stockage.demanderPersistance();
    vueAccueil();
  })();
})();
