# Chasse au trésor GPS

Application web mobile de chasse au trésor photo et GPS, pour des sorties en famille.
Le parent prépare un parcours à l'avance ; les enfants le découvrent ensuite sur le terrain.

Deux liens distincts, un par téléphone :

- `pilote.html` : téléphone du parent (préparation des parcours, puis pilotage du jeu) ;
- `joueur.html` : téléphone de l'enfant (scan des QR codes, arrivée sur le lieu, photo modèle).

## Avancement

| Bloc | Contenu | État |
|------|---------|------|
| 1 | Mode préparation : parcours, étapes, photos modèles, QR codes | validé |
| 2 | Mode pilote (téléphone parent) : QR code, photo modèle, validation, menu des étapes, annulation | en test |
| 3 | Mode joueur (téléphone enfant) | à faire |
| 4 | GPS et bascule vers / depuis Google Maps | à faire |

## Fonctionnement technique

- Site statique en HTML, CSS et JavaScript, sans étape de compilation : il suffit d'héberger les fichiers.
- Les parcours (y compris les photos, redimensionnées à 1280 px) sont enregistrés sur le téléphone du parent, dans le navigateur (IndexedDB).
  Le bouton « Sauvegarder dans un fichier » permet d'en garder une copie et de la réimporter.
- Chaque QR code contient le lien du mode joueur avec les seules coordonnées de l'étape :
  `joueur.html?lat=48.8459&lng=2.5534`. Scanné avec l'appareil photo du téléphone enfant, il ouvre directement le mode joueur.
- Génération des QR codes : [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (licence MIT), copié dans `js/vendor/`.

## Essayer en local

```sh
python3 -m http.server 8000
# puis ouvrir http://localhost:8000/pilote.html
```

La géolocalisation (« Utiliser ma position actuelle ») ne fonctionne que sur une adresse en `https://` ou sur `localhost`.
