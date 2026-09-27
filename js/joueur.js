// Téléphone enfant : scanner le QR code du parent, partir vers le lieu avec
// Google Maps, prendre la photo souvenir. Le téléphone ne connaît qu'une
// chose : la dernière destination scannée.

(() => {
  const CLE_DESTINATION = 'chasse-au-tresor:destination';
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

  function lienMaps(d) {
    // Épingle seule sur la carte, sans itinéraire : l'enfant choisit son chemin.
    return `https://www.google.com/maps/search/?api=1&query=${d.lat},${d.lng}`;
  }

  function memeDestination(a, b) {
    return a && b && Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6;
  }

  function nouvelleDestination(d) {
    const ancienne = lireDestination();
    enregistrerDestination({ lat: d.lat, lng: d.lng, scanneLe: Date.now() });
    majAccueil();
    montrerAnnonce(memeDestination(ancienne, d));
  }

  // ---------- Accueil ----------

  function majAccueil() {
    const d = lireDestination();
    $('btn-destination').disabled = !d;
    if (d) {
      $('message-titre').textContent = 'Cap sur le trésor !';
      $('message-texte').textContent = 'Touche « Rejoindre ma destination » pour ouvrir la carte. Une fois sur place, montre ton téléphone au capitaine.';
    } else {
      $('message-titre').textContent = 'Ahoy, moussaillon !';
      $('message-texte').textContent = 'Scanne le QR code du capitaine pour découvrir où se cache le prochain trésor.';
    }
  }

  $('btn-destination').addEventListener('click', () => {
    const d = lireDestination();
    if (d) window.open(lienMaps(d), '_blank', 'noopener');
  });

  // ---------- Annonce « Nouvelle destination » ----------

  function montrerAnnonce(dejaConnue) {
    const d = lireDestination();
    $('annonce-titre').textContent = dejaConnue ? 'Même destination !' : 'Nouvelle destination !';
    $('annonce-texte').textContent = dejaConnue
      ? "C'est toujours le même trésor. Continue à suivre la carte."
      : "Le trésor t'attend. Trouve ton chemin sur la carte, avec un adulte.";
    $('lien-maps').href = lienMaps(d);
    $('annonce').hidden = false;
  }
  $('btn-fermer-annonce').addEventListener('click', () => ($('annonce').hidden = true));
  $('lien-maps').addEventListener('click', () => setTimeout(() => ($('annonce').hidden = true), 500));

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
  }
})();
