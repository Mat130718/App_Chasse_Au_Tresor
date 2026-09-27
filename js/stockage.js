// Stockage des parcours sur le téléphone du parent (IndexedDB).
// Un parcours = { id, nom, creeLe, modifieLe, etapes: [{ id, nom, lat, lng, photo }] }
// L'ordre des étapes est l'ordre du tableau `etapes`.
// `photo` est une image JPEG redimensionnée, en data URL (ou null).

const Stockage = (() => {
  const NOM_BASE = 'chasse-au-tresor';
  const VERSION = 1;
  const TABLE = 'parcours';

  let basePromise = null;
  // Repli en mémoire si IndexedDB est indisponible (navigation privée, etc.).
  let memoire = null;

  function ouvrir() {
    if (basePromise) return basePromise;
    basePromise = new Promise((resolve, reject) => {
      let requete;
      try {
        requete = indexedDB.open(NOM_BASE, VERSION);
      } catch (e) {
        reject(e);
        return;
      }
      requete.onupgradeneeded = () => {
        const base = requete.result;
        if (!base.objectStoreNames.contains(TABLE)) {
          base.createObjectStore(TABLE, { keyPath: 'id' });
        }
      };
      requete.onsuccess = () => resolve(requete.result);
      requete.onerror = () => reject(requete.error);
      requete.onblocked = () => reject(new Error('Base bloquée'));
    });
    return basePromise;
  }

  function transaction(mode, action) {
    return ouvrir().then(
      (base) =>
        new Promise((resolve, reject) => {
          const tx = base.transaction(TABLE, mode);
          const table = tx.objectStore(TABLE);
          let resultat;
          const requete = action(table);
          if (requete) requete.onsuccess = () => (resultat = requete.result);
          tx.oncomplete = () => resolve(resultat);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error || new Error('Transaction annulée'));
        })
    );
  }

  async function disponible() {
    try {
      await ouvrir();
      return true;
    } catch (e) {
      memoire = memoire || new Map();
      return false;
    }
  }

  async function lister() {
    if (memoire) return [...memoire.values()].map(cloner);
    const tous = await transaction('readonly', (t) => t.getAll());
    return tous || [];
  }

  async function lire(id) {
    if (memoire) return memoire.has(id) ? cloner(memoire.get(id)) : null;
    return (await transaction('readonly', (t) => t.get(id))) || null;
  }

  async function enregistrer(parcours) {
    parcours.modifieLe = Date.now();
    if (memoire) {
      memoire.set(parcours.id, cloner(parcours));
      return parcours;
    }
    await transaction('readwrite', (t) => t.put(parcours));
    return parcours;
  }

  async function supprimer(id) {
    if (memoire) {
      memoire.delete(id);
      return;
    }
    await transaction('readwrite', (t) => t.delete(id));
  }

  function cloner(objet) {
    return JSON.parse(JSON.stringify(objet));
  }

  function nouvelId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  // Demande au navigateur de ne pas effacer les données en cas de manque de place.
  function demanderPersistance() {
    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
    } catch (e) {
      /* facultatif */
    }
  }

  return { disponible, lister, lire, enregistrer, supprimer, nouvelId, cloner, demanderPersistance };
})();
