// Téléphone enfant : scanner le QR code du parent, trouver le lieu sur la
// carte (sans itinéraire), détecter l'arrivée par GPS, prendre la photo
// souvenir. Le téléphone ne connaît qu'une chose : la dernière destination
// scannée.

(() => {
  const CLE_DESTINATION = 'chasse-au-tresor:destination';
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
    enregistrerDestination({ lat: d.lat, lng: d.lng, scanneLe: Date.now(), trouve: meme ? !!ancienne.trouve : false });
    majAccueil();
    suivrePosition();
    montrerAnnonce(meme);
  }

  // ---------- Accueil ----------

  function majAccueil() {
    const d = lireDestination();
    $('btn-destination').disabled = !d;
    if (d && d.trouve) {
      $('message-titre').textContent = 'Trésor trouvé !';
      $('message-texte').textContent = 'Montre ton téléphone au capitaine pour découvrir la photo à reproduire, puis prends ta photo.';
    } else if (d) {
      $('message-titre').textContent = 'Cap sur le trésor !';
      $('message-texte').textContent = 'Touche « Rejoindre ma destination » pour voir la carte. Le téléphone te préviendra quand tu seras arrivé.';
    } else {
      $('message-titre').textContent = 'Ahoy, moussaillon !';
      $('message-texte').textContent = 'Scanne le QR code du capitaine pour découvrir où se cache le prochain trésor.';
    }
  }

  $('btn-destination').addEventListener('click', ouvrirCarte);

  // ---------- Annonce « Nouvelle destination » ----------

  function montrerAnnonce(dejaConnue) {
    $('annonce-titre').textContent = dejaConnue ? 'Même destination !' : 'Nouvelle destination !';
    $('annonce-texte').textContent = dejaConnue
      ? "C'est toujours le même trésor. Continue à chercher sur la carte."
      : "Le trésor t'attend. Trouve ton chemin sur la carte, avec un adulte.";
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
      zone.textContent = 'Tu as trouvé le trésor ! Montre ton téléphone au capitaine.';
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
  if (depuisLien) {
    history.replaceState(null, '', window.location.pathname);
    nouvelleDestination(depuisLien);
  } else {
    majAccueil();
    suivrePosition();
  }
})();
