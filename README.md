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
| 2 | Mode pilote (téléphone parent) : QR code, puis indice (photo), validation, menu des étapes, annulation | validé |
| 3 | Mode joueur (téléphone enfant) : scan du QR code, ouverture de Google Maps, photo souvenir | en test |
| 4 | GPS et bascule vers / depuis Google Maps | à faire |

## Fonctionnement technique

- Site statique en HTML, CSS et JavaScript, sans étape de compilation : il suffit d'héberger les fichiers.
- Les parcours (y compris les photos, redimensionnées à 1280 px) sont enregistrés sur le téléphone du parent, dans le navigateur (IndexedDB).
  Le bouton « Sauvegarder dans un fichier » permet d'en garder une copie et de la réimporter.
- Chaque QR code contient le lien du mode joueur avec les seules coordonnées de l'étape :
  `joueur.html?lat=48.8459&lng=2.5534`. Scanné avec l'appareil photo du téléphone enfant, il ouvre directement le mode joueur.
- Génération des QR codes : [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (licence MIT), copié dans `js/vendor/`.
- Lecture des QR codes dans le mode joueur : [jsQR](https://github.com/cozmo/jsQR) (licence Apache 2.0), copié dans `js/vendor/`.
- Le téléphone enfant ne garde que la dernière destination scannée (localStorage).

En ligne : https://mat130718.github.io/App_Chasse_Au_Tresor/pilote.html (parent) et https://mat130718.github.io/App_Chasse_Au_Tresor/joueur.html (enfant).

## Essayer en local

```sh
python3 -m http.server 8000
# puis ouvrir http://localhost:8000/pilote.html
```

La géolocalisation (« Utiliser ma position actuelle ») ne fonctionne que sur une adresse en `https://` ou sur `localhost`.
