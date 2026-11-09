# Décisions techniques — phase préalable

Sources externes vérifiées le 4 novembre 2026 ; état local mis à jour le 7 novembre 2026. Les données en direct et les offres des services peuvent évoluer ; revérifier les entrées marquées ci-dessous avant leur utilisation dans le cours.

## Socle gamifié et intégration des activités

Vérifications locales du 7 novembre 2026 :

- La carte de l'accueil ouvre maintenant m0 à m3. Les illustrations de la page sont créées en CSS et les VFX de combat sont générés en DOM/CSS, sans ressource Nintendo.
- `assets/js/core/activity-session.js` fournit le point de raccordement des activités d'un module. Il requiert une progression valide et un stockage disponible, puis relie résultats d'exercices, score de quiz et résultat de combat aux récompenses et à la sauvegarde. L'appelant reçoit chaque nouvelle progression via `onProgress` pour actualiser l'interface. Une récompense unique n'est attribuée qu'au premier succès correspondant.
- La victoire au combat est la validation qui remplace le quiz et attribue le cœur de combat. L'épreuve du donjon est une activité distincte stockée sous `modules.<id>.dungeon`; elle n'accorde pas d'XP ni de cœur. Pour m0, B0 est facultative, dure au plus 15 minutes et enregistre une tentative dès son démarrage, une fois par date locale. Un rechargement après démarrage laisse une tentative interrompue ; les anciennes sauvegardes sans état `completed` restent valides.
- Les exercices peuvent préciser leur XP dans leur manifeste. Sans valeur, la récompense commune reste 20 XP ; m0 attribue 10, 15, 15 et 20 XP à E0.1–E0.4.
- M1 utilise Excel et Power Query comme voie principale. Ses réponses d'activités sont vérifiées dans le navigateur par hachage ; le fichier `results.json` exportable est destiné au dépôt individuel. Le classeur lui-même n'est jamais téléversé par la page.
- L'activité de données B1 est distincte du combat de connaissances : elle utilise un deuxième extrait de 10 000 lignes, dure au plus 45 minutes et comprend trois résultats à vérifier (deux montants et un classement avec son montant). Elle n'accorde pas d'XP ; le combat de validation reste le boss.
- M2 s'exécute dans le navigateur avec le runner SQL.js existant, en lecture seule. La base principale `hqo_lite.sqlite` et la base du boss utilisent le même schéma à 14 tables; la base B2 est produite séparément avec la graine 20261106 et 2 000 joueurs. Le parcours propose 30 requêtes graduées, cinq requêtes à déboguer (bonus sans XP et hors du seuil d'exercices), un combat de 20 questions et une épreuve SQL de 90 minutes (six questions, seuil 5/6, sans XP).
- M3 utilise le runner Pyodide existant et charge à la demande les CSV nécessaires. Il comprend huit leçons, huit exercices Python (NumPy, pandas, SciPy, statsmodels et graphiques Matplotlib), quatre widgets statistiques réutilisés, un combat de 20 questions et une épreuve B3 de deux heures. Le boss vérifie quatre statistiques, demande un mémo de 150 mots et une auto-évaluation; son résultat est enregistré sans XP.
- `exp_boss.csv` est généré seul par `generate_hqo_dataset.py --m3-boss-csv` avec la graine par défaut 20261107. Il compte 2 000 participants par bras et plante une rétention de 18 % contre 23 %, distincte de l'effet EXP_KOROK. Les réponses et vérités de référence restent privées; seul le fichier d'empreintes est servi au navigateur.
- Les solutions M2 restent dans `grading-private/answer_sources.json`; seules les empreintes des réponses SQL, du QCM et du boss sont chargées par le site. Les starters des 30 exercices sont des squelettes incomplets; les cinq activités D2 présentent intentionnellement une requête erronée à réparer.
- Le schéma M2 expose 14 tables et leurs relations 1-n / n-n sous forme de tables interactives accessibles. Les exercices SQL mettent à disposition trois indices progressifs; l'épreuve chronométrée n'en fournit aucun.
- Le runner SQL limite l'affichage et la comparaison à 200 lignes. B2.6 demande donc explicitement les 100 premiers identifiants triés, afin que la correction compare le résultat complet et non une sortie tronquée.
- Les callbacks d'activité sont distincts du traitement d'exécution : une erreur d'enregistrement ou de rendu de progression est annoncée explicitement et ne transforme pas un exercice pourtant exécuté en erreur d'exécution.
- Le smoke test conservé dans `scripts/integration-smoke.html` vérifie le runtime navigateur avec SQLite, le snapshot Compendium, l'API fictive, le client Python paginé et le contrôle de hash. Il s'agit d'une page de test manuel, pas d'une page pédagogique.
- Un défaut de liaison ESM découvert pendant cette recette provenait d'un import de `API_ORIGIN` depuis `mock/routes.js` au lieu de `mock/mock-api.js`. L'import corrigé est protégé par `scripts/test_course_runtime.mjs`.
- Vérification navigateur de m0 : les trois exercices Python ont réussi et persisté leurs XP ; le combat a été gagné en 8 questions, avec **150 XP** et un badge ; B0 a été réussi sans XP et bloqué pour une nouvelle tentative le même jour.
- L'import/export de progression a été exercé dans l'accueil ; les transformations de progression/JSON sont en outre couvertes par les tests Node. En test responsive, `scrollWidth` égale `clientWidth` à 375 px. La media query `prefers-reduced-motion: reduce` réduit les animations CSS à 0,01 ms et neutralise la transformation de secousse.
- La recette du module m0 à 360 px confirme que la largeur du document reste égale à celle de la fenêtre. Les blocs de code trop longs défilent à l'intérieur de leur conteneur.
- `README-ENSEIGNANT.md` décrit le serveur statique, les dépendances de développement et les tests. `grading-private/answer_sources.json` reste hors de `course/` et est ignoré par Git ; seul le fichier haché est chargé par le site.
- Les fichiers `GROUND_TRUTH.md` et `module1-boutique-*-anomalies.json` sont réservés à l'enseignant et conservés dans `grading-private/`, jamais dans le dossier statique `course/`. Le générateur écrit ces références dans `--private-output` et ne les copie pas dans le site.
- Les extraits M1 sont des fichiers élève distincts : 10 000 lignes chacun ; l'extrait principal a 40 doublons, 12 prix négatifs, 25 dates futures, 300 noms incohérents et 18 quantités zéro. L'extrait B1 a d'autres nombres d'anomalies.
- Le générateur `scripts/build_hashes.py` accepte désormais les identifiants `Q<n>.<n>` en plus des exercices et défis.
- Un défaut du vérificateur Python a été corrigé : Pyodide renvoie directement `answer`, et non `result.answer`. Les trois exercices de m0 ont été vérifiés dans le navigateur contre le vrai runner.
- Le dossier `course/data/` représente environ 40,5 MB au relevé local. Contrôler à nouveau la taille totale du site avant publication.
- Un `.gitignore` local ignore caches Python, environnements locaux, fichiers `.env` et `node_modules`. L'archive `base-gitignore.zip` ne contenait pas de modèle `.gitignore`; aucun remote Git n'est configuré et aucune modification GitHub n'a été effectuée.

## Dépôt et diffusion

- Décision utilisateur du 9 novembre 2026 : utiliser GitHub Pages gratuit avec un dépôt source public, un site public et sans domaine personnalisé. L'URL prévue est `https://darktravus.github.io/hyrule-analytics-academy/`. Le dépôt local ne dispose pas de remote configuré ; aucun commit, push, réglage distant ou déploiement n'a été effectué.
- Les élèves créeront chacun leur propre dépôt à partir des consignes du cours ; il n'y aura pas de dépôt-modèle distinct.
- Toute opération dans l'interface ou le dépôt GitHub distant doit être confirmée par l'utilisateur avant exécution.
- Décision utilisateur du 9 novembre 2026 : conserver l'habillage et les références Zelda/Hyrule tels qu'ils sont. Cette décision remplace les notes antérieures qui prévoyaient leur remplacement; ne pas les retirer dans le cadre du module 3 ni de la préparation du déploiement à venir.
- L'accès élève visé est une URL web du MVP ; le serveur local sert au développement et n'est pas le mode de distribution prévu. La sortie statique à liste blanche est implémentée par `course/scripts/build_site.py` ; les choix d'hébergeur et de visibilité sont actés. La publication elle-même reste à effectuer après confirmation, création/configuration du dépôt et push initial.
- Le workflow `.github/workflows/pages.yml` est manuel uniquement (`workflow_dispatch`). La sortie testée comprend 70 fichiers pour 17 953 535 octets ; les outils enseignant, scripts et caches sont exclus. Le projet reste sans collecte de compte élève et conserve sa progression dans le navigateur.
- Les données du Compendium ne doivent pas redistribuer les champs `description` et `image`. Ne créer aucun visuel officiel ; privilégier des illustrations originales ou des pictogrammes.

## Hyrule Compendium API

Documentation du projet consultée le 4 novembre 2026 :

- Documentation actuelle : [Compendium API](https://hyrule-compendium.com/compendium-api) et [Regions API](https://hyrule-compendium.com/regions-api).
- Hôte documenté : `https://api.hyrule-compendium.com/v3`.
- Les anciennes URLs du cahier (Heroku ou endpoint `/api/v3/entry`) ne sont plus celles indiquées par la documentation actuelle.
- Endpoints documentés : `/compendium/entry/<entry>`, `/compendium/all`, `/compendium/category/<category>`, `/compendium/master_mode/entry/<entry>`, `/compendium/master_mode/all` et `/regions/all`.
- Les catégories documentées sont `creatures`, `equipment`, `materials`, `monsters` et `treasure`. Le paramètre `game` sélectionne BotW (`1` ou `botw`) ou TotK (`2` ou `totk`) ; sans paramètre, la documentation indique BotW.
- Le schéma varie selon la catégorie. Les champs documentés comprennent notamment `id`, `name`, `category`, `common_locations`, ainsi que des champs comme `drops`, `properties`, `hearts_recovered`, `cooking_effect`, `edible` ou `dlc`.
- Le snapshot ne conserve que les champs structurés utiles au parcours ; il exclut `description` et `image` conformément au cahier des charges.

Vérifications réseau en lecture seule effectuées le 4 novembre 2026 :

- GET d'une entrée, de `/compendium/all`, de `/compendium/category/monsters` et de `/regions/all` : HTTP 200.
- Le GET de l'entrée `white-maned_lynel` renvoie une enveloppe JSON `data` avec `category`, `common_locations`, `drops`, `id`, `name`, `description` et `image` (ainsi que `dlc`).
- Pour l'origine de test `https://example.invalid`, la réponse a renvoyé un `Access-Control-Allow-Origin` correspondant ; l'appel navigateur depuis le site devra être revalidé lors de son implémentation.
- Le total observé dans `/compendium/all` est **389 entrées** : `creatures` 83, `equipment` 185, `materials` 36, `monsters` 81, `treasure` 4. C'est une mesure ponctuelle, pas une constante à coder.
- La documentation ne décrit pas de pagination pour `/compendium/all`. Le script de snapshot devra respecter au plus une requête par seconde, gérer les erreurs/reprises et inclure la date de collecte.
- L'hôte et les routes répondent actuellement, mais un snapshot local reste nécessaire pour la résilience hors ligne. Revérifier disponibilité, CORS et schéma au moment d'extraire le jeu retenu.

## Pyodide et paquets

- La page officielle des paquets et l'API GitHub des releases ont été consultées le 4 novembre 2026.
- Dernière release publiée repérée : **Pyodide 314.0.7** (`https://github.com/pyodide/pyodide/releases/tag/314.0.7`). Épingler une version exacte dans le code ; ne jamais dépendre de `latest`.
- La liste de cette release contient les paquets requis :

| Paquet | Version observée |
| --- | --- |
| numpy | 2.4.6 |
| pandas | 3.0.2 |
| scipy | 1.18.0 |
| matplotlib | 3.10.8 |
| statsmodels | 0.14.6 |
| scikit-learn | 1.8.0 |

- Les versions indiquées sont celles de la liste de paquets consultée ; faire un test de fumée réel du Worker et des imports quand le runner est implémenté.
- L'API GitHub indique une archive de distribution complète de 337 536 678 octets. Cette archive n'a pas été téléchargée ; ce chiffre n'est pas le poids que chargera nécessairement la page. Charger Pyodide et les paquets à la demande, puis mesurer le transfert initial réel, la durée de démarrage et le cache navigateur avant de promettre une taille ou un temps.

## GitHub Pages et taille du dépôt

Documentation GitHub consultée le 4 novembre 2026 :

- Site Pages publié : maximum **1 GB** ; déploiement interrompu après **10 minutes**.
- Bande passante : limite souple indiquée de **100 GB par mois**.
- Limite souple de **10 builds par heure**, qui ne s'applique pas au déploiement via un workflow GitHub Actions personnalisé.
- Dépôt source Pages : recommandation de rester sous **1 GB**.
- Git normal avertit au-delà de **50 MiB** par fichier et bloque les fichiers de plus de **100 MiB** ; la limite d'ajout via navigateur est de 25 MiB.
- Le cahier vise moins de 60 MB au total : garder cet objectif prudent, surtout pour les données versionnées. Ne pas inclure les archives d'environnement Pyodide.
- GitHub Pages ne doit pas servir de SaaS ou de site commercial transactionnel. Le projet est un site pédagogique statique sans collecte d'informations.

## Power BI

- La documentation Microsoft sur les licences Power BI a été consultée le 4 novembre 2026.
- Power BI Desktop reste l'outil par défaut du module 5 selon l'avenant ; il nécessite Windows.
- La licence gratuite du service Power BI permet de créer et consulter du contenu pour soi, mais ne permet pas le partage et la collaboration avec d'autres utilisateurs sans capacité/licence appropriée.
- Le service web gratuit peut être documenté comme alternative individuelle, mais ne remplace pas un test de tableau de bord par un tiers. Conserver le livrable `.pbix` et préciser la limite du plan B. Revérifier les capacités/licences lors de la rédaction du module 5.

## Contrats de la bibliothèque partagée et recette navigateur

- Le moteur de correction JavaScript consomme le format `answers_hashed.json` du correcteur : objet `{ salt, items }`, puis `items[id]` avec `kind`, `hash` et, selon le type, `tol` ou `order_matters`. Les réponses en clair restent dans `grading-private/answer_sources.json`, hors du dossier publié, et ne sont pas intégrées dans le client.
- Pour une question multi-sélection, la convention de réponse est le tableau JSON des identifiants d'options triés, haché comme texte avec `hash_text`. La définition de référence doit donc stocker cette représentation JSON exacte comme valeur texte.
- Les exercices Python fournissent un champ pédagogique `answer_expression` évalué après le code et les assertions ; `result_kind` vaut `text` par défaut, ou `num` si le résultat est numérique. Ne pas accepter implicitement un script sans résultat vérifiable.
- Le worker Python expose `get_json(url)` lorsque le proxy réseau du cours est activé. Le proxy n'autorise que l'API du cours et le Compendium ; l'exercice E0.1 utilise le Compendium puis son miroir si le service distant ne répond pas.
- Pyodide `314.0.7` exige un Worker de type module : la documentation officielle indique que les workers classiques et `importScripts()` ne sont pas pris en charge. Le runner doit charger `pyodide.mjs` épinglé et définir explicitement `indexURL`.
- Les widgets CLT, A/B, puissance et Bayes ne bloquent pas m0 ; les implémenter avant leur premier usage, sans ajouter des calculs isolés qui n'auraient pas encore de contrat pédagogique.
- Recette navigateur locale réalisée : SQL.js a interrogé la base légère HQO et Pyodide/pandas a lu un CSV monté puis retourné un résultat et une erreur Python ; l'interface combat a été parcourue à la souris et au clavier. Ces essais ciblés ne remplacent pas le smoke test intégré du site.

## Génération des données HQO

- La graine par défaut est `20261104`. Les données restent synthétiques ; aucun fichier ne doit contenir de données personnelles réelles.
- Les trois cohortes expérimentales sont réservées exactement pour atteindre les effectifs du cahier. Pour EXP_PACK, le bras B a 5 acheteurs mobiles sur 200 (2,5 %), valeur entière la plus proche sous les 3 % du bras A ; 6 sur 200 donnerait une égalité et invaliderait le paradoxe de Simpson. Le bras B a 92 acheteurs PC sur 800 (11,5 %), contre 24 sur 200 (12 %) dans A.
- Les acheteurs EXP_PACK doivent avoir une ligne d'achat du produit `pack_aventurier` dans les trois premiers jours ; le test recalcule la métrique à partir des commandes et lignes de commande.
- Le générateur utilise 40 noms issus du snapshot Compendium pour les 80 objets. Les régions comprennent neuf noms exacts du snapshot et trois variantes volontairement différentes.
- La probabilité du nombre de sessions par jour actif suit `1 + Poisson(0,6)`, conformément au cahier. La distribution exacte du volume total doit être vérifiée par le test d'acceptation avant de poursuivre.
- La reproductibilité porte sur les fichiers produits : l'horodatage variable des faits est retiré, les métadonnées ZIP sont normalisées, et l'ordre dépendant d'un ensemble est trié. Le test compare les SHA-256 de deux générations complètes.
- Le 6 novembre 2026, l'utilisateur a indiqué que le générateur avait été corrigé dans le CLI Copilot et que les jeux avaient été régénérés. Les corrections rapportées concernent les seuils de churn, le paradoxe de Simpson, le champ `name` dans les CSV, les faux positifs de détection de numéros de téléphone et les métadonnées Excel.
- Vérification indépendante le 6 novembre 2026 : `python .\course\scripts\test_dataset.py` réussit avec **9 tests** (`9 passed in 260.20s`). Les seuils de la suite d'acceptation sont donc validés pour les données actuellement présentes.
- `scripts/build_hashes.py` est créé. Il lit `data/expected/answer_sources.json` par défaut, accepte des définitions `text`, `num` et `sql`, et génère `data/expected/answers_hashed.json`. Il réutilise `grading/hashing.py`, conserve le sel si le fichier de sortie existe, et protège les requêtes SQL par une connexion en lecture seule.
- Le générateur a été testé avec `python .\course\scripts\test_build_hashes.py` (**5 tests réussis**) et le correcteur avec `python .\course\grading\selftest.py` (`selftest OK`).
- Le catalogue des définitions de réponses n'existe pas encore ; les modules et leurs exercices ne sont pas encore rédigés. Le fichier final de hachages n'a donc volontairement pas été créé. Les valeurs de référence devront provenir des exercices approuvés et des données générées, pas être inventées pour remplir le fichier. L'étape données/correction reste en cours jusque-là.
- Décision utilisateur du 6 novembre 2026 : respecter la règle du suivi (au plus un module par conversation). La constitution du catalogue complet des réponses de référence demeure explicitement à faire ; l'ajouter progressivement à partir des exercices effectivement élaborés, sans commencer plusieurs modules dans la même conversation. Générer et vérifier `answers_hashed.json` une fois les définitions nécessaires disponibles.

## Bibliothèque partagée — avancement d'implémentation

- Le moteur `assets/js/core/boss-fight.js` valide désormais la banque, les règles et la graine à la création ; les IDs doivent être uniques, les difficultés comprises entre 1 et 3. Une résolution doit cibler la prochaine question et recevoir un booléen ; toute résolution après la fin est refusée.
- `assets/js/core/canon.js` expose maintenant les équivalents JavaScript des hachages de texte et numériques de `grading/hashing.py` (`hashText`, `numCell`, `hashNum`, `matchNum`). Les cases numériques rejettent NaN et les infinis. Les tests Node `scripts/test_canon.mjs` vérifient des vecteurs Python incluant espaces, accents, emoji, valeurs négatives et arrondis pairs.
- `scripts/test_boss_fight.mjs` couvre reproductibilité, dégâts, série critique, phase 2, fin sur épuisement de banque et rejets d'entrées invalides.
- Vérification le 6 novembre 2026 : 10 tests Node passent ; la simulation de combat à 20 000 essais donne 67,2 % à 80 % de justesse et 5,1 % à 50 %. L'implémentation de la bibliothèque reste partielle : les runners, l'API fictive, la progression, les jetons, widgets et interface du combat restent à réaliser.
- Progression et jetons : `assets/js/core/progress.js` fournit le format local version 1 (clé `hqo_progress_v1`), validation, import/export JSON et fonctions de stockage. Le schéma garde la progression combat sous `fight`, selon l'avenant. Aucune sauvegarde existante est distincte d'une sauvegarde invalide ; les erreurs de parsing et de stockage ne sont pas masquées.
- `assets/js/core/token.js` encode la charge JSON `{ alias, module, hearts, xp, date, nonce }` en base64url UTF-8 et calcule les 16 premiers caractères hexadécimaux du SHA-256 de la charge concaténée au sel. La vérification valide les champs et l'encodage canonique. Le sel est public : le jeton n'est pas une garantie cryptographique forte.
- `scripts/test_progress_token.mjs` complète la suite avec stockage/export/import, alias/versions invalides et vérifications de jetons unicode et altérés. Au 6 novembre 2026, 14 tests Node (combat, canonisation, progression, jetons) passent ; le selftest Python du correcteur reste vert.

## Environnement de développement local

- L'utilisateur a installé fnm avec `winget install Schniz.fnm`, puis Node.js 26 avec `fnm install 26`. Versions rapportées et vérifiées : Node.js `v26.13.0`, npm `11.20.0`.
- Le processus PowerShell de l'agent n'a pas hérité du `PATH` modifié après l'installation. L'exécution du binaire via `%APPDATA%\fnm\node-versions\v26.13.0\installation\node.exe` fonctionne.
- `course/scripts/balance_sim.mjs 20000` a été exécuté avec Node 26.13.0. Résultats : à 80 % de justesse, **67,2 %** de victoires ; à 50 %, **5,1 %**. Ces résultats satisfont les seuils de l'avenant (60–75 % à 80 %, moins de 10 % à 50 %).
- Le correcteur initial passe `python course/grading/selftest.py` (`selftest OK`).

## Sources consultées

- [Documentation Hyrule Compendium API](https://hyrule-compendium.com/compendium-api)
- [Documentation Hyrule Regions API](https://hyrule-compendium.com/regions-api)
- [Releases Pyodide](https://github.com/pyodide/pyodide/releases)
- [Paquets inclus dans Pyodide](https://pyodide.org/en/stable/usage/packages-in-pyodide.html)
- [Limites GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [Limites de taille des fichiers GitHub](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)
- [Licences et capacités Power BI](https://learn.microsoft.com/en-us/power-bi/fundamentals/service-features-license-type)
