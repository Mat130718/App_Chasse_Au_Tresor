// Téléphone enfant : scanner le QR code du parent, trouver le lieu sur la
// carte (sans itinéraire), détecter l'arrivée par GPS, prendre la photo
// souvenir. Le téléphone ne connaît qu'une chose : la dernière destination
// scannée.

(() => {
  const CLE_DESTINATION = 'chasse-au-tresor:destination';
  const CLE_FIN = 'chasse-au-tresor:fin';
  const RAYON_METRES = 50;
  // Au-delà de cette imprécision, on n'annonce pas l'arrivée (risque de fausse alerte).
  const PRECISION_MAX_METRES = 75;
  const $ = (id) => document.getElementById(id);

  // ---------- Destination (dernier QR code scanné) ----------

  function lireDestination() {
    try {
      const d = JSON.parse(localStorage.getItem(CLE_DESTINATION));
      return d && isFinite(d.lat) && isFinite(d.lng) ? d : destinationMemoire;
    } catch (e) {
      return destinationMemoire;
    }
  }

  let destinationMemoire = null;
  function enregistrerDestination(d) {
    destinationMemoire = d;
    try {
      localStorage.setItem(CLE_DESTINATION, JSON.stringify(d));
    } catch (e) {
      /* stockage indisponible : on garde la destination en mémoire */
    }
  }

  // Lit lat/lng dans un lien du type joueur.html?lat=48.8459&lng=2.5534
  function lireLien(texte) {
    try {
      const url = new URL(texte, window.location.href);
      const lat = parseFloat(url.searchParams.get('lat'));
      const lng = parseFloat(url.searchParams.get('lng'));
      if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
      return { lat, lng };
    } catch (e) {
      return null;
    }
  }

  // QR code de la fin de la chasse : joueur.html?fin=1
  function estLienFin(texte) {
    try {
      return new URL(texte, window.location.href).searchParams.get('fin') === '1';
    } catch (e) {
      return false;
    }
  }

  function lireFin() {
    try {
      return localStorage.getItem(CLE_FIN) === '1';
    } catch (e) {
      return finMemoire;
    }
  }
  let finMemoire = false;
  function enregistrerFin(fin) {
    finMemoire = fin;
    try {
      if (fin) localStorage.setItem(CLE_FIN, '1');
      else localStorage.removeItem(CLE_FIN);
    } catch (e) {
      /* stockage indisponible */
    }
  }

  // Distance en mètres entre deux points GPS (formule de haversine).
  function distanceMetres(a, b) {
    const R = 6371000;
    const rad = (x) => (x * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function memeDestination(a, b) {
    return a && b && Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6;
  }

  function nouvelleDestination(d) {
    const ancienne = lireDestination();
    const meme = memeDestination(ancienne, d);
    enregistrerFin(false);
    enregistrerDestination({ lat: d.lat, lng: d.lng, scanneLe: Date.now(), trouve: meme ? !!ancienne.trouve : false });
    majAccueil();
    suivrePosition();
    montrerAnnonce(meme);
  }

  // ---------- Accueil ----------

  function majAccueil() {
    const d = lireDestination();
    $('btn-destination').disabled = !d;
    if (!d && lireFin()) {
      $('message-titre').textContent = 'Chasse terminée !';
      $('message-texte').textContent = 'Bravo, moussaillon, tu as trouvé le grand trésor ! Rendez-vous pour une prochaine aventure.';
    } else if (d && d.trouve) {
      $('message-titre').textContent = 'Tu es arrivé à bon port !';
      $('message-texte').textContent = 'Le capitaine a un indice pour toi. Retrouve l’indice et prends-le en photo pour poursuivre l’aventure.';
    } else if (d) {
      $('message-titre').textContent = 'Cap sur le trésor !';
      $('message-texte').textContent = 'Touche « Rejoindre ma destination » pour voir la carte. Le téléphone te préviendra quand tu seras arrivé.';
    } else {
      $('message-titre').textContent = 'Ohé, moussaillon !';
      $('message-texte').textContent = 'En avant pour l’aventure ! Scanne le QR code du capitaine pour découvrir où se cache la prochaine étape du parcours.';
    }
  }

  $('btn-destination').addEventListener('click', ouvrirCarte);

  // ---------- Annonce « Nouvelle destination » ----------

  function montrerAnnonce(dejaConnue) {
    $('annonce-titre').textContent = dejaConnue ? 'Même destination !' : 'Nouvelle destination !';
    $('annonce-texte').textContent = dejaConnue
      ? "C'est toujours le même trésor. Continue à chercher sur la carte."
      : 'Le trésor t’attend. Trouve ton chemin sur la carte. En avant, matelot !';
    $('annonce').hidden = false;
  }
  $('btn-fermer-annonce').addEventListener('click', () => ($('annonce').hidden = true));
  $('btn-voir-carte').addEventListener('click', () => {
    $('annonce').hidden = true;
    ouvrirCarte();
  });

  // ---------- Carte intégrée (OpenStreetMap, sans itinéraire) ----------

  let carte = null;
  let marqueurTresor = null;
  let marqueurMoi = null;
  let cercleMoi = null;
  let dernierePosition = null;
  let dejaCadree = false;

  function creerCarte() {
    carte = L.map('carte-leaflet', { zoomControl: false, attributionControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(carte);
    carte.attributionControl.setPrefix(false);
  }

  function ouvrirCarte() {
    const d = lireDestination();
    if (!d) return;
    $('carte').hidden = false;
    if (!carte) creerCarte();
    carte.invalidateSize();
    const tresor = [d.lat, d.lng];
    const icone = L.divIcon({ className: 'icone-tresor', html: '<span>✕</span>', iconSize: [48, 48], iconAnchor: [24, 24] });
    if (marqueurTresor) marqueurTresor.setLatLng(tresor);
    else marqueurTresor = L.marker(tresor, { icon: icone, keyboard: false, interactive: false }).addTo(carte);
    dejaCadree = false;
    majMarqueurMoi();
    cadrer();
    majDistance();
    suivrePosition();
    garderEcranAllume();
  }

  function fermerCarte() {
    $('carte').hidden = true;
    libererEcran();
  }

  // Montre à la fois l'enfant et le trésor.
  function cadrer() {
    const d = lireDestination();
    if (!carte || !d) return;
    if (dernierePosition) {
      carte.fitBounds(L.latLngBounds([[d.lat, d.lng], [dernierePosition.lat, dernierePosition.lng]]), { padding: [60, 60], maxZoom: 18 });
      dejaCadree = true;
    } else {
      carte.setView([d.lat, d.lng], 17);
    }
  }

  function majMarqueurMoi() {
    if (!carte || !dernierePosition) return;
    const ll = [dernierePosition.lat, dernierePosition.lng];
    if (marqueurMoi) {
      marqueurMoi.setLatLng(ll);
      cercleMoi.setLatLng(ll).setRadius(dernierePosition.precision);
    } else {
      cercleMoi = L.circle(ll, { radius: dernierePosition.precision, color: '#2b7de9', weight: 1, fillOpacity: 0.12, interactive: false }).addTo(carte);
      marqueurMoi = L.marker(ll, { icon: L.divIcon({ className: 'icone-moi', iconSize: [22, 22], iconAnchor: [11, 11] }), keyboard: false, interactive: false }).addTo(carte);
    }
    if (!dejaCadree && !$('carte').hidden) cadrer();
  }

  function majDistance() {
    const d = lireDestination();
    const zone = $('carte-distance');
    if (!d) return;
    if (d.trouve) {
      zone.textContent = 'Tu es arrivé à bon port ! Montre ton téléphone au capitaine.';
    } else if (erreurPosition) {
      zone.textContent = erreurPosition;
    } else if (!dernierePosition) {
      zone.textContent = 'Recherche de ta position…';
    } else {
      const m = distanceMetres(dernierePosition, d);
      const texte = m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(m / 10) * 10} m`;
      zone.textContent = dernierePosition.precision > PRECISION_MAX_METRES ? `Trésor à environ ${texte}. Signal GPS faible, avance à découvert.` : `Le trésor est à ${texte}.`;
    }
  }

  $('btn-fermer-carte').addEventListener('click', fermerCarte);
  $('btn-recentrer').addEventListener('click', cadrer);

  // ---------- GPS : détection de l'arrivée ----------

  let suivi = null;
  let erreurPosition = null;

  function suivrePosition() {
    const d = lireDestination();
    if (!d || d.trouve || suivi !== null || !navigator.geolocation) return;
    suivi = navigator.geolocation.watchPosition(nouvellePosition, erreurGps, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
  }

  function arreterSuivi() {
    if (suivi !== null) navigator.geolocation.clearWatch(suivi);
    suivi = null;
  }

  function nouvellePosition(pos) {
    erreurPosition = null;
    dernierePosition = { lat: pos.coords.latitude, lng: pos.coords.longitude, precision: pos.coords.accuracy };
    majMarqueurMoi();
    const d = lireDestination();
    if (d && !d.trouve && pos.coords.accuracy <= PRECISION_MAX_METRES && distanceMetres(dernierePosition, d) <= RAYON_METRES) {
      arrivee();
    }
    majDistance();
  }

  function erreurGps(err) {
    erreurPosition = err.code === 1
      ? "Il faut autoriser la position. Demande à un adulte d'aller dans les réglages du navigateur."
      : 'Position introuvable pour le moment. Avance un peu à découvert.';
    majDistance();
  }

  function arrivee() {
    const d = lireDestination();
    d.trouve = true;
    enregistrerDestination(d);
    arreterSuivi();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
    majAccueil();
    majDistance();
    $('trouve').hidden = false;
  }

  $('btn-fermer-trouve').addEventListener('click', () => {
    $('trouve').hidden = true;
    fermerCarte();
  });

  // Les navigateurs coupent le GPS quand la page est cachée : on relance au retour.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      arreterSuivi();
    } else {
      suivrePosition();
      if (!$('carte').hidden) garderEcranAllume();
    }
  });

  // Garde l'écran allumé pendant que la carte est affichée, si le téléphone le permet.
  let verrouEcran = null;
  async function garderEcranAllume() {
    try {
      if ('wakeLock' in navigator && !verrouEcran) {
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

  // ---------- Scanner ----------

  const video = $('video');
  const canvas = document.createElement('canvas');
  const contexte = canvas.getContext('2d', { willReadFrequently: true });
  let flux = null;
  let boucle = null;

  async function ouvrirScanner() {
    $('scanner').hidden = false;
    $('scanner-aide').textContent = 'Vise le QR code du capitaine';
    try {
      flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      video.srcObject = flux;
      await video.play();
      boucle = requestAnimationFrame(analyser);
    } catch (e) {
      $('scanner-aide').textContent =
        e && e.name === 'NotAllowedError'
          ? "Il faut autoriser l'appareil photo. Demande à un adulte d'aller dans les réglages du navigateur."
          : "L'appareil photo ne s'ouvre pas. Tu peux aussi scanner le QR code avec l'appareil photo du téléphone.";
    }
  }

  function fermerScanner() {
    cancelAnimationFrame(boucle);
    boucle = null;
    if (flux) flux.getTracks().forEach((piste) => piste.stop());
    flux = null;
    video.srcObject = null;
    $('scanner').hidden = true;
  }

  let dernierRefus = 0;
  function analyser() {
    if (!flux) return;
    if (video.readyState >= 2 && video.videoWidth) {
      // Image réduite pour une analyse rapide sur les petits téléphones.
      const echelle = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * echelle);
      canvas.height = Math.round(video.videoHeight * echelle);
      contexte.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = contexte.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
      if (code && code.data) {
        if (estLienFin(code.data)) {
          if (navigator.vibrate) navigator.vibrate(120);
          fermerScanner();
          celebrer();
          return;
        }
        const d = lireLien(code.data);
        if (d) {
          if (navigator.vibrate) navigator.vibrate(120);
          fermerScanner();
          nouvelleDestination(d);
          return;
        }
        if (Date.now() - dernierRefus > 1500) {
          dernierRefus = Date.now();
          $('scanner-aide').textContent = "Ce QR code n'est pas celui de la chasse au trésor.";
        }
      }
    }
    boucle = requestAnimationFrame(analyser);
  }

  $('btn-scanner').addEventListener('click', ouvrirScanner);
  $('btn-fermer-scanner').addEventListener('click', fermerScanner);
  document.addEventListener('visibilitychange', () => document.hidden && flux && fermerScanner());

  // ---------- Grande célébration de fin de chasse ----------

  function celebrer() {
    arreterSuivi();
    enregistrerDestination(null);
    enregistrerFin(true);
    majAccueil();
    $('annonce').hidden = true;
    $('trouve').hidden = true;
    fermerCarte();
    const jour = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    $('diplome').textContent = `Grand trésor du ${jour}`;
    jouerCelebration();
  }

  let minuteurs = [];
  function jouerCelebration() {
    const ecran = $('celebration');
    minuteurs.forEach(clearTimeout);
    minuteurs = [];
    ecran.hidden = false;
    ecran.classList.remove('joue');
    void ecran.offsetWidth; // relance les animations CSS
    const animations = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (animations) ecran.classList.add('joue');
    garderEcranAllume();
    const ouverture = animations ? 1900 : 0;
    minuteurs.push(setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate([80, 60, 80, 60, 300]);
      jouerFanfare();
      if (animations) lancerConfettis();
    }, ouverture));
  }

  $('btn-rejouer').addEventListener('click', jouerCelebration);
  $('btn-fermer-celebration').addEventListener('click', () => {
    $('celebration').hidden = true;
    $('celebration').classList.remove('joue');
    minuteurs.forEach(clearTimeout);
    arreterConfettis();
    libererEcran();
  });

  // Pièces d'or qui jaillissent du coffre, puis pluie de confettis.
  const toile = $('confettis');
  const pinceau = toile.getContext('2d');
  let particules = [];
  let animationConfettis = null;
  let debutConfettis = 0;
  const COULEURS = ['#f2b134', '#d1495b', '#3a9d5d', '#f6e7c1', '#62b4ca', '#ffffff'];

  function lancerConfettis() {
    const dpr = window.devicePixelRatio || 1;
    toile.width = toile.clientWidth * dpr;
    toile.height = toile.clientHeight * dpr;
    pinceau.setTransform(dpr, 0, 0, dpr, 0, 0);
    const l = toile.clientWidth;
    const h = toile.clientHeight;
    const coffre = document.querySelector('.grand-coffre').getBoundingClientRect();
    const cx = coffre.left + coffre.width / 2;
    const cy = coffre.top + coffre.height * 0.45;
    particules = [];
    for (let i = 0; i < 70; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
      const vitesse = 7 + Math.random() * 9;
      particules.push({ type: 'piece', x: cx, y: cy, vx: Math.cos(angle) * vitesse, vy: Math.sin(angle) * vitesse, r: 7 + Math.random() * 6, tour: Math.random() * 6, vtour: 0.15 + Math.random() * 0.25 });
    }
    for (let i = 0; i < 160; i++) {
      particules.push({ type: 'confetti', x: Math.random() * l, y: -20 - Math.random() * h * 1.5, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3, l: 6 + Math.random() * 6, h: 10 + Math.random() * 8, angle: Math.random() * 6, vangle: (Math.random() - 0.5) * 0.3, couleur: COULEURS[i % COULEURS.length], oscille: Math.random() * 6 });
    }
    debutConfettis = performance.now();
    cancelAnimationFrame(animationConfettis);
    animationConfettis = requestAnimationFrame(dessinerConfettis);
  }

  function dessinerConfettis(t) {
    const l = toile.clientWidth;
    const h = toile.clientHeight;
    pinceau.clearRect(0, 0, l, h);
    let vivantes = 0;
    for (const p of particules) {
      if (p.y > h + 40) continue;
      vivantes++;
      if (p.type === 'piece') {
        p.vy += 0.35;
        p.vx *= 0.995;
        p.x += p.vx;
        p.y += p.vy;
        p.tour += p.vtour;
        const largeur = Math.abs(Math.cos(p.tour)) * p.r + 1.5;
        pinceau.beginPath();
        pinceau.ellipse(p.x, p.y, largeur, p.r, 0, 0, Math.PI * 2);
        pinceau.fillStyle = '#ffd24a';
        pinceau.fill();
        pinceau.lineWidth = 2;
        pinceau.strokeStyle = '#b8860b';
        pinceau.stroke();
        pinceau.beginPath();
        pinceau.ellipse(p.x - largeur * 0.3, p.y - p.r * 0.3, largeur * 0.25, p.r * 0.25, 0, 0, Math.PI * 2);
        pinceau.fillStyle = 'rgba(255, 255, 255, 0.7)';
        pinceau.fill();
      } else {
        p.oscille += 0.05;
        p.x += p.vx + Math.sin(p.oscille) * 0.8;
        p.y += p.vy;
        p.angle += p.vangle;
        pinceau.save();
        pinceau.translate(p.x, p.y);
        pinceau.rotate(p.angle);
        pinceau.scale(1, Math.cos(p.oscille * 2));
        pinceau.fillStyle = p.couleur;
        pinceau.fillRect(-p.l / 2, -p.h / 2, p.l, p.h);
        pinceau.restore();
      }
    }
    if (vivantes > 0 && t - debutConfettis < 15000) animationConfettis = requestAnimationFrame(dessinerConfettis);
    else pinceau.clearRect(0, 0, l, h);
  }

  function arreterConfettis() {
    cancelAnimationFrame(animationConfettis);
    pinceau.clearRect(0, 0, toile.width, toile.height);
    particules = [];
  }

  // Petite fanfare jouée par le téléphone (le son n'est permis qu'après un toucher).
  let audio = null;
  document.addEventListener('pointerdown', () => {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
    } catch (e) {
      audio = null;
    }
  });

  function note(frequence, debut, duree, volume = 0.18, forme = 'triangle') {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = forme;
    osc.frequency.value = frequence;
    gain.gain.setValueAtTime(0, debut);
    gain.gain.linearRampToValueAtTime(volume, debut + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, debut + duree);
    osc.connect(gain).connect(audio.destination);
    osc.start(debut);
    osc.stop(debut + duree + 0.05);
  }

  function jouerFanfare() {
    if (!audio || audio.state !== 'running') return;
    const t = audio.currentTime + 0.05;
    // Do Mi Sol Do, puis accord final et scintillements de pièces.
    [523.25, 659.25, 783.99].forEach((f, i) => note(f, t + i * 0.14, 0.2));
    [1046.5, 1318.5, 1568].forEach((f) => note(f, t + 0.45, 1.2, 0.12));
    note(523.25, t + 0.45, 1.2, 0.12, 'sawtooth');
    for (let i = 0; i < 8; i++) note(2000 + Math.random() * 1500, t + 0.6 + i * 0.12, 0.15, 0.05, 'sine');
  }

  // ---------- Photo souvenir ----------

  let urlPhoto = null;
  $('champ-photo').addEventListener('change', (e) => {
    const fichier = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!fichier) return;
    if (urlPhoto) URL.revokeObjectURL(urlPhoto);
    urlPhoto = URL.createObjectURL(fichier);
    $('photo-image').src = urlPhoto;
    $('photo').hidden = false;
  });
  $('btn-fermer-photo').addEventListener('click', () => ($('photo').hidden = true));

  // ---------- Démarrage ----------

  // Arrivée par un QR code scanné avec l'appareil photo du téléphone.
  const depuisLien = lireLien(window.location.href);
  if (estLienFin(window.location.href)) {
    history.replaceState(null, '', window.location.pathname);
    celebrer();
  } else if (depuisLien) {
    history.replaceState(null, '', window.location.pathname);
    nouvelleDestination(depuisLien);
  } else {
    majAccueil();
    suivrePosition();
  }
})();
