# Brief : web app de suivi de prépa marathon

## 1. Objectif

Construire une petite web app (mobile first, utilisée surtout sur iPhone) qui affiche le plan d'entraînement du **marathon du dimanche 4 avril 2027** et permet de **valider chaque séance faite**. Déploiement : repo GitHub, puis Vercel.

Le coureur (Sancho, en France, fuseau Europe/Paris) veut **finir sans se blesser, ni pendant la prépa ni pendant la course**. Chrono visé : environ 4h30 (fourchette 4h15-4h50), sans enjeu. L'app doit donc rassurer et protéger, pas pousser.

Contexte santé, à respecter dans tous les textes de l'app : un genou sans ligaments croisés avec ménisque opéré, un genou aux ligaments croisés opérés dont le ménisque coince à l'accroupissement. Une blessure passée est venue d'une reprise trop rapide (1 h dès la première sortie). Principe central du plan : progression de **10 % maximum (≈ 11 %)** entre deux vraies sorties longues, semaines allégées toutes les 4 semaines.

## 2. Stack et livraison

- Version 1 : site statique, aucun backend. Au choix de Claude Code : Vite (vanilla ou Preact) ou HTML/JS simple. Éviter un framework lourd.
- Données du plan : fichier `plan.json` fourni avec ce brief (26 semaines, 4 séances par semaine). Ne pas retaper le plan à la main : le charger depuis ce fichier.
- Progression : `localStorage` (clé versionnée, accès entouré de try/catch). Prévoir **export et import** de la progression en JSON (copier/coller), pour passer du téléphone à l'ordinateur.
- Déploiement : repo GitHub, projet Vercel (preset Vite ou « Other » pour du statique). Pas de variable d'environnement.
- Version 2, à ne pas faire sans demander : synchronisation entre appareils via Supabase (le développeur le connaît déjà).

## 3. Les données du plan

Chaque semaine de `plan.json` contient `n`, `start` (lundi), `phase`, `allegee`, `tag` et 4 séances (`lun`, `mer`, `ven`, `dim`) avec `id`, `date`, `type` (`renfo`, `run_easy`, `run_quality`, `run_long`, `race`, `rest`), `minutes`, `place` et `title`. La séance de repos (lundi de la semaine 26) ne compte pas dans la progression. Total à valider : 103 séances.

Vue d'ensemble, pour contrôle :

| Sem. | Début (lundi) | Lundi midi, salle | Mercredi midi, tapis | Vendredi soir, tapis | Dimanche, extérieur |
| --- | --- | --- | --- | --- | --- |
| 1 | 5 oct. | Renfo A · 2 séries | 25 min facile | 20 min facile | 0h30 |
| 2 | 12 oct. | Renfo A · 2 séries | 25 min facile | 20 min facile | 0h33 |
| 3 | 19 oct. | Renfo A · 2 séries | 25 min facile | 20 min facile | 0h36 |
| 4 (allégée) | 26 oct. | Renfo A · 2 séries | 20 min facile | 15 min facile | 0h28 |
| 5 | 2 nov. | Renfo A · 3 séries | 30 min facile | 25 min facile | 0h40 |
| 6 | 9 nov. | Renfo A · 3 séries | 30 min facile | 25 min facile | 0h44 |
| 7 | 16 nov. | Renfo A · 3 séries | 30 min facile | 25 min facile | 0h49 |
| 8 (allégée) | 23 nov. | Renfo A · 2 séries | 25 min facile | 20 min facile | 0h35 |
| 9 | 30 nov. | Renfo A · 3 séries | 35 min facile | 30 min facile | 0h54 |
| 10 | 7 déc. | Renfo A · 3 séries | 35 min facile | 30 min facile | 1h00 |
| 11 | 14 déc. | Renfo A · 3 séries | 40 min facile | 30 min facile | 1h06 |
| 12 (allégée (Noël)) | 21 déc. | Renfo A · 2 séries | 30 min facile | 25 min facile | 0h50 |
| 13 | 28 déc. | Renfo A · 3 séries | 3 × 6 min soutenu (≈ 45 min avec échauffement) | 40 min facile | 1h13 |
| 14 | 4 janv. | Renfo A · 3 séries | 3 × 8 min soutenu (≈ 50 min avec échauffement) | 40 min facile | 1h21 |
| 15 | 11 janv. | Renfo A · 3 séries | 4 × 8 min soutenu (≈ 55 min avec échauffement) | 40 min facile | 1h30 |
| 16 (allégée) | 18 janv. | Renfo A · 2 séries | 3 × 6 min soutenu (≈ 45 min avec échauffement) | 30 min facile | 1h05 |
| 17 | 25 janv. | Renfo A · 3 séries | 1h dont 15 min allure marathon | 40 min facile | 1h39 |
| 18 | 1 févr. | Renfo A · 3 séries | 1h dont 20 min allure marathon | 40 min facile | 1h50 |
| 19 | 8 févr. | Renfo A · 3 séries | 1h dont 25 min allure marathon | 40 min facile | 2h02 |
| 20 (allégée) | 15 févr. | Renfo A · 2 séries | 1h dont 15 min allure marathon | 30 min facile | 1h30 |
| 21 | 22 févr. | Renfo A · 3 séries | 1h dont 30 min allure marathon | 40 min facile | 2h15 |
| 22 (point de décision pour le pic) | 1 mars | Renfo A · 3 séries | 1h dont 30 min allure marathon | 40 min facile | 2h30 |
| 23 (pic) | 8 mars | Renfo A · 2 séries | 1h dont 20 min allure marathon | 35 min facile | 2h46 |
| 24 | 15 mars | Renfo A · 2 séries | 40 min facile | 30 min facile | 1h50 |
| 25 | 22 mars | Renfo A léger · 15 min | 30 min facile | 25 min facile | 1h20 |
| 26 | 29 mars | Repos | 25 min facile | 20 min très facile | **Marathon, dim. 4 avril** |

Règles de lecture, à afficher dans l'app :
- Toutes les sorties se courent **à allure facile** (parler en phrases complètes), sauf les blocs « soutenu » et « allure marathon ».
- Sortie longue : **1 min de marche toutes les 10 à 15 min** dès qu'elle dépasse 1 h, et le jour de la course si besoin.
- Les semaines allégées ne se sautent pas.
- Une séance ratée ne se rattrape pas. Deux séances ratées : on reprend la semaine précédente. Un enfant malade ou un rush au travail : on raccourcit, on ne compense jamais.
- Point de décision en **semaine 22** : si un genou a protesté en semaine 21 ou 22, le pic de la semaine 23 (2h46) est ramené à 2h30.

## 4. Fonctionnalités de la version 1

1. **Aujourd'hui** (écran d'accueil) : compte à rebours en jours avant le 4 avril 2027, séance du jour ou prochaine séance, bouton pour la valider, progression de la semaine (x / 4) et globale.
2. **Plan** : les 26 semaines en liste, la semaine en cours ouverte et visible au chargement, case à cocher par séance, indicateur d'allègement. Si la date du jour est avant le 5 octobre 2026, afficher la semaine 1 ; après le marathon, afficher un écran de fin.
3. **Profil des sorties longues** : un graphique (SVG) des 25 durées de sortie longue, qui montre la montée et les creux des semaines allégées, avec la semaine en cours repérée et les sorties faites remplies. C'est l'élément visuel principal de l'app.
4. **Ressenti des genoux** (optionnel à chaque validation) : trois états « RAS », « gêne », « douleur », enregistrés avec la séance. Si « douleur » est choisi, ou si « gêne » apparaît deux séances de suite, afficher un encart clair : lever le pied, ne pas augmenter la sortie longue, voir un kiné du sport. Le texte ne pose pas de diagnostic.
5. **Renfo** : séances A (lundi) et B (vendredi), contenu ci-dessous.
6. **Repères** : allures, règles de la section 3, signaux d'alerte, jour de course.
7. **Export calendrier** : bouton qui génère un fichier `.ics` de toutes les séances (heures flottantes, sans fuseau : lundi et mercredi 12 h, vendredi 19 h, dimanche 9 h ; le marathon le 4 avril 2027 à 9 h), à ouvrir dans l'app Calendrier de l'iPhone.
8. **Sauvegarde** : export et import de la progression (section 2).

Qualité attendue : lisible au soleil sur un téléphone, zones tactiles d'au moins 44 px, navigation clavier, `prefers-reduced-motion` respecté, aucune dépendance à Internet une fois chargée, mode clair et sombre automatiques. Ajouter un manifeste web pour installer l'app sur l'écran d'accueil de l'iPhone. Un service worker pour l'usage hors ligne est un plus, pas une obligation.

## 5. Contenu de l'onglet Renfo

Principe : le renfo protège les genoux plus qu'une sortie de course supplémentaire. Ce contenu est général et à faire valider par un kiné.

**Séance A, lundi midi, à la salle (20 à 30 min)**
Échauffement 5 min : marche rapide ou vélo.
Séries : voir `title` dans `plan.json` (2 séries au début, en allégement et en affûtage ; 3 séries de la semaine 5 à 22). Repos 60 à 90 s entre séries.
1. Presse à cuisses : 10 à 12 répétitions, charge modérée, genoux fléchis à 90° maximum.
2. Curl ischios (« leg curl », machine assise ou allongée) : 10 à 12 répétitions, montée en 2 s, descente en 3 s. Les ischios stabilisent le genou sans ligaments croisés.
3. Montée sur marche basse (15 à 20 cm) : 8 par jambe, mouvement contrôlé, bassin stable.
4. Pont fessier : 12 répétitions, puis sur une jambe quand c'est facile.
5. Mollets debout : 15 répétitions.
6. Gainage : planche 30 s ; planche latérale 20 s de chaque côté.
Effort : il reste 2 répétitions « en réserve ». Si le genou fait mal (plus de 3 sur 10) ou si le ménisque se bloque, on arrête l'exercice.

**Séance B, vendredi soir, 10 min après la course**
Pont fessier 2 × 12 ; marche latérale avec élastique 2 × 12 pas de chaque côté ; mollets 2 × 15 ; planche 2 × 30 s.

**À éviter, ou à valider avec le kiné** : accroupissements profonds (ménisque qui coince), machine d'extension de jambe en charge (genou sans croisés), fentes avec rotation, sauts.

## 6. Contenu de l'onglet Repères

Chiffres indicatifs, l'effort prime sur la montre. Base : semi en 1h47, mais en forme actuelle moins bonne, et longues sorties passées entre 6:11 et 6:48 par km.

| Allure | min/km | km/h (tapis) | Sensation |
| --- | --- | --- | --- |
| Facile | 6:45 à 7:15 | 8,3 à 8,9 | phrases complètes |
| Allure marathon | ≈ 6:25 | ≈ 9,3 | régulier, quelques mots |
| Soutenu | 5:55 à 6:10 | 9,7 à 10,1 | par bribes |

Sur tapis : pente de 1 %. Arrivée estimée : environ 4h30, avec les minutes de marche.

Signaux d'alerte : un genou qui gonfle ou fait mal plus de 2 à 3 jours après une sortie ; un ménisque qui se bloque en courant ; une douleur qui change la foulée. Dans ces cas, lever le pied et voir un kiné du sport avant d'allonger la sortie longue. Le ménisque qui coince à l'accroupissement doit être montré au kiné ou au chirurgien **avant la semaine 9**, quand les sorties dépassent 1 h.

Terrain : chemin ou terre pour la sortie longue quand c'est possible ; tapis le reste du temps. Chaussures : à changer vers 600 à 800 km.

## 7. Direction design

Proposition à valider par le développeur, qui est directeur artistique : le sujet est la route et le balisage, pas le « bien-être ».
- Un seul élément mémorable : le profil des sorties longues (fonctionnalité 3). Tout le reste reste calme.
- Palette proposée : papier gris-vert `#ECEFEC`, bitume `#1C2125`, jaune de marquage routier `#D9A81E` (accent), bleu ardoise `#3C5A6B` (séances faites), rouille `#B5482F` réservé aux alertes genou. Le mode sombre inverse papier et bitume.
- Typographie : une seule famille à axe de chasse, Archivo (Google Fonts), condensée pour les titres et les chiffres, normale pour le texte. Casse de phrase, pas de capitales.
- Pas de cartes arrondies uniformes, pas de dégradés décoratifs, pas d'animation d'entrée. Seul mouvement : la réponse au geste (cocher une séance remplit la barre).
- Ton des textes : phrases courtes, tutoiement, jamais culpabilisant.

## 8. Apple Watch

Hors périmètre de la version 1. Une page web ne peut pas envoyer de séance à l'app Entraînement de l'Apple Watch : cela demande une app native (Swift, compte développeur Apple) ou une app tierce de course qui sait le faire. À vérifier avant d'y consacrer du temps, car ce point peut avoir évolué. L'export `.ics` vers le Calendrier de l'iPhone est la solution de rechange. Pour les séances soutenues du mercredi, le développeur peut créer à la main une séance personnalisée dans l'app Entraînement de la montre.

## 9. Critères d'acceptation

- Le plan affiché correspond exactement à `plan.json` : 26 semaines, 103 séances à valider, dates correctes (semaine 1 du lundi 5 octobre 2026, semaine 26 avec le marathon le dimanche 4 avril 2027).
- La progression survit à un rechargement de la page et passe d'un appareil à l'autre par export et import.
- Le `.ics` s'importe dans le Calendrier de l'iPhone avec les bonnes dates et heures.
- Test de dates : simuler le 1er octobre 2026, le 22 janvier 2027 et le 6 avril 2027, vérifier la semaine affichée.
- Aucun message de l'app ne dit au coureur de forcer ou de rattraper une séance.
- Lighthouse mobile : accessibilité et bonnes pratiques à 95 ou plus.

## 10. Points à confirmer avec le développeur avant de coder

1. Vite ou HTML simple.
2. Palette et typographie proposées ci-dessus : OK ou à changer.
3. Le ressenti des genoux (fonctionnalité 4) : à garder dans la version 1 ?
4. Synchronisation Supabase : maintenant ou plus tard ?
