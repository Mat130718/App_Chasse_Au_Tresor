// Mode préparation (téléphone du parent) : créer et gérer les parcours,
// leurs étapes, les photos modèles et les QR codes.

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

  function formaterCoord(n) {
    return Number(n).toFixed(5).replace(/0+$/, '').replace(/\.$/, '');
  }

  function texteCoords(etape) {
    return `${formaterCoord(etape.lat)}, ${formaterCoord(etape.lng)}`;
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

  function lienGoogleMaps(etape) {
    return `https://www.google.com/maps/search/?api=1&query=${etape.lat},${etape.lng}`;
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
      return new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
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

  function barre(titre, { retour, actions = [] } = {}) {
    return el(
      'header',
      { class: 'barre' },
      retour ? el('button', { class: 'btn-icone', 'aria-label': 'Retour', onclick: retour }, '‹') : el('span', { class: 'marque', 'aria-hidden': 'true' }, '✕'),
      el('h1', {}, titre),
      el('div', { class: 'barre-actions' }, actions)
    );
  }

  // ---------- Écran : liste des parcours ----------

  async function vueAccueil() {
    const tous = (await Stockage.lister()).sort((a, b) => b.modifieLe - a.modifieLe);
    const contenu = el('main', { class: 'page' });

    if (!stockageOk) {
      contenu.append(
        el(
          'p',
          { class: 'alerte' },
          "Ce navigateur n'autorise pas la sauvegarde : tes parcours seront perdus en fermant la page. Ouvre l'application dans Chrome ou Safari (hors navigation privée)."
        )
      );
    }

    contenu.append(
      el('div', { class: 'intro' },
        el('h2', {}, 'Mes parcours'),
        el('p', {}, 'Prépare ici tes chasses au trésor : les lieux, les photos à reproduire et l’ordre des étapes. Tout reste enregistré sur ce téléphone.')
      )
    );

    if (tous.length === 0) {
      contenu.append(el('p', { class: 'vide' }, "Aucun parcours pour l'instant."));
    } else {
      const liste = el('ul', { class: 'liste-parcours' });
      for (const p of tous) {
        const nbPhotos = p.etapes.filter((e) => e.photo).length;
        liste.append(
          el(
            'li',
            {},
            el(
              'button',
              { class: 'carte-parcours', onclick: () => ouvrirParcours(p.id) },
              el('span', { class: 'carte-titre' }, p.nom),
              el(
                'span',
                { class: 'carte-infos' },
                pluriel(p.etapes.length, 'étape'),
                ' · ',
                `${nbPhotos}/${p.etapes.length} photos`,
                ' · ',
                `modifié le ${dateCourte(p.modifieLe)}`
              ),
              p.partie && !p.partie.cloturee && el('span', { class: 'pastille pastille-attention carte-pastille' }, 'Chasse en cours'),
              el('span', { class: 'chevron', 'aria-hidden': 'true' }, '›')
            )
          )
        );
      }
      contenu.append(liste);
    }

    const aExemple = tous.some((p) => p.nom === EXEMPLE_NOISY.nom);
    contenu.append(
      el(
        'div',
        { class: 'pile-boutons' },
        el('button', { class: 'btn btn-principal btn-large', onclick: creerParcours }, '+ Nouveau parcours'),
        !aExemple && el('button', { class: 'btn', onclick: chargerExemple }, "Charger l'exemple Noisy-le-Grand (11 étapes)"),
        el('label', { class: 'btn', for: 'import-fichier' }, 'Importer un parcours sauvegardé'),
        el('input', { id: 'import-fichier', type: 'file', accept: '.json,application/json', hidden: true, onchange: importerParcours })
      )
    );

    afficher(barre('Préparation'), contenu);
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

  async function ouvrirParcours(id) {
    parcoursCourant = await Stockage.lire(id);
    if (!parcoursCourant) return vueAccueil();
    vueParcours();
    window.scrollTo(0, 0);
  }

  async function sauver() {
    await Stockage.enregistrer(parcoursCourant);
  }

  function vueParcours() {
    const p = parcoursCourant;
    const contenu = el('main', { class: 'page' });

    const manquantes = p.etapes.filter((e) => !e.photo).length;
    contenu.append(
      el(
        'div',
        { class: 'resume' },
        el('span', {}, pluriel(p.etapes.length, 'étape')),
        p.etapes.length > 0 &&
          el('span', { class: manquantes ? 'pastille pastille-attention' : 'pastille pastille-ok' }, manquantes ? `${pluriel(manquantes, 'photo')} manquante${manquantes > 1 ? 's' : ''}` : 'Toutes les photos sont prêtes')
      )
    );

    if (manquantes > 0) {
      contenu.append(el('p', { class: 'aide' }, 'Touche « + Photo » à gauche d’une étape pour prendre ou choisir la photo que les enfants devront reproduire.'));
    }

    if (p.etapes.length > 0) {
      const partie = partieValide(p);
      contenu.append(
        partie && !partie.cloturee
          ? el(
              'div',
              { class: 'pile-boutons' },
              el('button', { class: 'btn btn-jeu btn-large', onclick: () => vueJeu() }, partie.terminee || partie.fin ? '▶ Reprendre la chasse (fin de la chasse)' : `▶ Reprendre la chasse (étape ${indexCourant(p, partie) + 1} sur ${p.etapes.length})`),
              el('button', { class: 'btn', onclick: recommencerPartie }, 'Recommencer depuis le début')
            )
          : el('button', { class: 'btn btn-jeu btn-large', onclick: nouvellePartie }, '▶ Lancer la chasse')
      );
    }

    if (p.etapes.length === 0) {
      contenu.append(el('p', { class: 'vide' }, 'Ajoute la première étape : un lieu, sa position GPS et la photo que les enfants devront reproduire.'));
    }

    const liste = el('ol', { class: 'liste-etapes' });
    p.etapes.forEach((etape, index) => {
      const premier = index === 0;
      const dernier = index === p.etapes.length - 1;
      liste.append(
        el(
          'li',
          { class: 'etape' },
          el('span', { class: 'numero' }, String(index + 1)),
          boutonPhotoEtape(etape, index),
          el(
            'button',
            { class: 'etape-texte', onclick: () => vueEtape(etape.id), 'aria-label': `Modifier l'étape ${index + 1} : ${etape.nom}` },
            el('span', { class: 'etape-nom' }, etape.nom),
            el('span', { class: 'etape-coords' }, texteCoords(etape))
          ),
          el(
            'div',
            { class: 'etape-actions' },
            el('button', { class: 'btn-qr', onclick: () => afficherQr(index), 'aria-label': `QR code de l'étape ${index + 1}`, html: svgQr(contenuQr(etape)) }),
            el(
              'div',
              { class: 'fleches' },
              el('button', { class: 'btn-fleche', disabled: premier, 'aria-label': 'Monter', onclick: () => deplacer(index, -1) }, '↑'),
              el('button', { class: 'btn-fleche', disabled: dernier, 'aria-label': 'Descendre', onclick: () => deplacer(index, 1) }, '↓')
            )
          )
        )
      );
    });
    if (p.etapes.length > 0) {
      liste.append(
        el(
          'li',
          { class: 'etape etape-fin' },
          el('span', { class: 'numero numero-fin', 'aria-hidden': 'true' }, '★'),
          el('span', { class: 'vignette vignette-fin', 'aria-hidden': 'true' }, 'Fin'),
          el('div', { class: 'etape-texte' }, el('span', { class: 'etape-nom' }, 'Fin de la chasse'), el('span', { class: 'etape-coords' }, 'QR code final, toujours en dernier')),
          el(
            'div',
            { class: 'etape-actions' },
            el('button', { class: 'btn-qr', onclick: () => afficherQr(p.etapes.length), 'aria-label': 'QR code de la fin de la chasse', html: svgQr(contenuQrFin()) })
          )
        )
      );
    }
    contenu.append(liste);

    contenu.append(
      el(
        'div',
        { class: 'pile-boutons' },
        el('button', { class: 'btn btn-principal btn-large', onclick: () => vueEtape(null) }, '+ Ajouter une étape'),
        el('h3', { class: 'sous-titre' }, 'Parcours'),
        el('button', { class: 'btn', onclick: renommerParcours }, 'Renommer'),
        el('button', { class: 'btn', onclick: dupliquerParcours }, 'Dupliquer (pour en faire un nouveau)'),
        el('button', { class: 'btn', onclick: exporterParcours }, 'Sauvegarder dans un fichier'),
        el('button', { class: 'btn btn-danger-texte', onclick: supprimerParcours }, 'Supprimer ce parcours')
      )
    );

    afficher(barre(p.nom, { retour: vueAccueil }), contenu);
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
      etape.photo ? el('img', { class: 'vignette', src: etape.photo, alt: '' }) : el('span', { class: 'vignette vignette-vide' }, el('span', { class: 'plus' }, '+'), 'Photo'),
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
    const lienVerif = el('a', { class: 'lien', target: '_blank', rel: 'noopener', hidden: true }, 'Vérifier sur Google Maps ↗');

    function majCoords() {
      const c = lireCoords(champCoords.value);
      champCoords.classList.toggle('invalide', !!champCoords.value.trim() && !c);
      if (c) {
        brouillon.lat = c.lat;
        brouillon.lng = c.lng;
        aideCoords.textContent = `Position retenue : ${texteCoords(c)}. Les enfants devront arriver à moins de ${RAYON_METRES} m.`;
        lienVerif.href = lienGoogleMaps(c);
        lienVerif.hidden = false;
      } else {
        brouillon.lat = brouillon.lng = null;
        aideCoords.textContent = champCoords.value.trim()
          ? 'Position non reconnue. Écris la latitude puis la longitude, par exemple 48.8459, 2.5534.'
          : 'Dans Google Maps, appuie longuement sur le lieu : les coordonnées s’affichent, copie-les ici. Tu peux aussi coller le lien de partage.';
        lienVerif.hidden = true;
      }
    }
    champCoords.addEventListener('input', majCoords);

    const boutonPosition = el('button', { type: 'button', class: 'btn', onclick: utiliserMaPosition }, '📍 Utiliser ma position actuelle');
    function utiliserMaPosition() {
      if (!navigator.geolocation) {
        toast("Ce téléphone ne donne pas accès à la position.");
        return;
      }
      boutonPosition.disabled = true;
      boutonPosition.textContent = 'Recherche de la position…';
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          champCoords.value = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
          majCoords();
          boutonPosition.disabled = false;
          boutonPosition.textContent = '📍 Utiliser ma position actuelle';
          toast(`Position trouvée (précision ± ${Math.round(pos.coords.accuracy)} m).`);
        },
        (err) => {
          boutonPosition.disabled = false;
          boutonPosition.textContent = '📍 Utiliser ma position actuelle';
          toast(err.code === 1 ? "L'accès à la position a été refusé. Autorise-le dans les réglages du navigateur." : "Position introuvable pour l'instant. Réessaie à l'extérieur.");
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
    }

    const apercu = el('div', { class: 'apercu-photo' });
    function majApercu() {
      apercu.replaceChildren(
        brouillon.photo ? el('img', { src: brouillon.photo, alt: 'Photo modèle' }) : el('div', { class: 'apercu-vide' }, 'Aucune photo pour cette étape')
      );
      boutonPhoto.textContent = brouillon.photo ? 'Changer la photo' : 'Choisir une photo';
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
    const boutonPhoto = el('label', { class: 'btn btn-principal', for: 'etape-photo' }, 'Choisir une photo');
    const boutonRetirer = el('button', { type: 'button', class: 'btn btn-danger-texte', onclick: () => ((brouillon.photo = null), majApercu()) }, 'Retirer la photo');

    const choixOrdre = el('select', { id: 'etape-ordre' });
    for (let i = 1; i <= total; i++) {
      choixOrdre.append(el('option', { value: i, selected: i === positionInitiale }, `Étape ${i}${i === total && !existante ? ' (à la fin)' : ''}`));
    }

    const formulaire = el(
      'form',
      { class: 'page formulaire', onsubmit: (e) => (e.preventDefault(), enregistrerEtape()) },
      el('div', { class: 'champ' }, el('label', { for: 'etape-nom' }, 'Nom du lieu'), champNom),
      el(
        'div',
        { class: 'champ' },
        el('label', { for: 'etape-coords' }, 'Position GPS'),
        champCoords,
        aideCoords,
        el('div', { class: 'rangee' }, boutonPosition, lienVerif)
      ),
      el(
        'div',
        { class: 'champ' },
        el('span', { class: 'etiquette' }, 'Photo modèle à reproduire'),
        apercu,
        el('div', { class: 'rangee' }, boutonPhoto, boutonRetirer),
        champPhoto
      ),
      el('div', { class: 'champ' }, el('label', { for: 'etape-ordre' }, 'Place dans le parcours'), choixOrdre),
      el(
        'div',
        { class: 'pile-boutons' },
        el('button', { type: 'submit', class: 'btn btn-principal btn-large' }, existante ? 'Enregistrer' : "Ajouter l'étape"),
        existante && el('button', { type: 'button', class: 'btn btn-danger-texte', onclick: supprimerEtape }, 'Supprimer cette étape')
      )
    );

    async function enregistrerEtape() {
      brouillon.nom = champNom.value.trim();
      if (!brouillon.nom) {
        toast('Donne un nom à ce lieu.');
        champNom.focus();
        return;
      }
      if (brouillon.lat === null) {
        toast('Indique la position GPS du lieu.');
        champCoords.focus();
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

    majCoords();
    majApercu();
    afficher(barre(existante ? `Étape ${index + 1}` : 'Nouvelle étape', { retour: vueParcours }), formulaire);
    window.scrollTo(0, 0);
    if (!existante) champNom.focus();
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

  function vueJeu() {
    const p = parcoursCourant;
    const partie = partieValide(p);
    if (!partie) return vueParcours();
    enJeu = true;
    garderEcranAllume();

    const total = p.etapes.length;
    const nbValidees = partie.validees.length;
    const boutonEtapes = el('button', { class: 'btn btn-petit', onclick: afficherMenuEtapes }, 'Étapes');
    const boutonAnnuler = el(
      'button',
      { class: 'btn', disabled: partie.historique.length === 0, onclick: annulerValidation },
      '↶ Annuler'
    );

    const texteValidees = `${pluriel(nbValidees, 'étape')} validée${nbValidees > 1 ? 's' : ''} sur ${total}`;

    if (partie.cloturee) {
      const bilan = el(
        'main',
        { class: 'page page-jeu' },
        el(
          'div',
          { class: 'fin' },
          el('p', { class: 'fin-icone', 'aria-hidden': 'true' }, '★'),
          el('h2', {}, 'Chasse terminée !'),
          el('p', {}, `${texteValidees}.`)
        ),
        el(
          'div',
          { class: 'pile-boutons' },
          el('button', { class: 'btn btn-principal btn-large', onclick: quitterJeu }, 'Retour au parcours'),
          el('button', { class: 'btn', onclick: () => changerFin({ cloturee: false }) }, '‹ Revoir le QR code final'),
          el('button', { class: 'btn', onclick: recommencerPartie }, 'Recommencer depuis le début')
        )
      );
      afficher(barre(p.nom, { retour: quitterJeu, actions: [boutonEtapes] }), bilan);
      window.scrollTo(0, 0);
      return;
    }

    // Étape finale : un QR code seul, qui déclenche la célébration chez l'enfant.
    if (partie.terminee || partie.fin) {
      const fin = el(
        'main',
        { class: 'page page-jeu' },
        el(
          'div',
          { class: 'jeu-entete' },
          el('p', { class: 'jeu-progression' }, `Étape finale · ${texteValidees}`),
          el('h2', {}, 'Fin de la chasse')
        ),
        el('div', { class: 'qr-grand', role: 'img', 'aria-label': 'QR code de la fin de la chasse', html: svgQr(contenuQrFin()) }),
        el('p', { class: 'aide centre' }, 'Fais scanner ce QR code aux enfants : une surprise les attend !')
      );
      afficher(
        barre(p.nom, { retour: quitterJeu, actions: [boutonEtapes] }),
        fin,
        el('footer', { class: 'barre-jeu' }, boutonAnnuler, el('button', { class: 'btn btn-valider btn-large', onclick: () => changerFin({ cloturee: true }) }, '✓ Terminer la chasse'))
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
    const entete = el(
      'div',
      { class: 'jeu-entete' },
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
            el('h3', { class: 'sous-titre centre' }, 'Indice : la photo à reproduire'),
            etape.photo
              ? el('img', { src: etape.photo, alt: `Photo modèle : ${etape.nom}` })
              : el('p', { class: 'apercu-vide' }, "Pas de photo pour cette étape. Tu peux en ajouter une depuis l'écran du parcours.")
          ),
          el('p', { class: 'aide centre' }, 'Quand la photo de l’enfant ressemble au modèle, valide-la pour afficher le QR code suivant.'),
          el('button', { class: 'btn', onclick: () => changerIndice(false) }, '‹ Revoir le QR code')
        )
      : el(
          'main',
          { class: 'page page-jeu' },
          entete,
          el('div', { class: 'qr-grand', role: 'img', 'aria-label': `QR code de l'étape ${index + 1}`, html: svgQr(contenuQr(etape)) }),
          el('p', { class: 'aide centre' }, "L'enfant scanne ce QR code pour trouver le lieu. Une fois sur place, touche « Indice »."),
        );

    const boutonAction = dejaValidee
      ? el('button', { class: 'btn btn-principal btn-large', onclick: allerProchaine }, 'Étape suivante ›')
      : indice
        ? el('button', { class: 'btn btn-valider btn-large', onclick: validerPhoto }, '✓ Photo validée')
        : el('button', { class: 'btn btn-principal btn-large', onclick: () => changerIndice(true) }, 'Indice');

    afficher(
      barre(p.nom, { retour: quitterJeu, actions: [boutonEtapes] }),
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
    const fermer = () => voile.remove();
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
          el('span', { class: 'numero numero-fin' }, '★'),
          el('span', { class: 'menu-etape-nom' }, 'Fin de la chasse'),
          el('span', { class: `pastille ${finCourante ? 'pastille-attention' : 'pastille-neutre'}` }, finCourante ? 'En cours' : 'Finale')
        )
      )
    );
    const voile = el(
      'div',
      { class: 'voile voile-bas', onclick: (e) => e.target === voile && fermer() },
      el(
        'div',
        { class: 'feuille', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'menu-titre' },
        el('div', { class: 'feuille-entete' }, el('h2', { id: 'menu-titre' }, 'Étapes du parcours'), el('button', { class: 'btn btn-petit', onclick: fermer }, 'Fermer')),
        el('p', { class: 'aide' }, "Touche une étape pour afficher son QR code, par exemple pour en sauter une si les enfants sont fatigués."),
        liste
      )
    );
    document.body.append(voile);
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
          el('button', { class: 'btn', disabled: index === 0, onclick: () => aller(-1) }, '‹ Précédente'),
          el('button', { class: 'btn', disabled: estFin, onclick: () => aller(1) }, 'Suivante ›')
        ),
        el('button', { class: 'btn btn-principal btn-large', onclick: fermer }, 'Fermer')
      );
    }
    document.addEventListener('keydown', clavier);
    dessiner();
    document.body.append(voile);
  }

  // ---------- Démarrage ----------

  function afficher(...noeuds) {
    app.replaceChildren(...noeuds);
  }

  let stockageOk = true;
  (async () => {
    stockageOk = await Stockage.disponible();
    if (stockageOk) Stockage.demanderPersistance();
    vueAccueil();
  })();
})();
