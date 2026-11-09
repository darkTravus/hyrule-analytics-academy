# Chroniques d'Hyrule Analytics

Un parcours progressif pour apprendre l'analyse de données par la pratique.

## Accéder au cours

- **Site élève :** [ouvrir Chroniques d'Hyrule Analytics](https://darktravus.github.io/hyrule-analytics-academy/). Les élèves n'ont pas à cloner ce dépôt ni à lancer un serveur local.
- **Dépôt source public :** [darkTravus/hyrule-analytics-academy](https://github.com/darkTravus/hyrule-analytics-academy). Le site est hébergé gratuitement sur GitHub Pages, sans domaine personnalisé.
- En attendant, le site de développement se trouve dans [`course/`](./course/) et son lancement local est décrit dans le guide enseignant, non publié.
- Tu créeras ton propre dépôt GitHub pour tes travaux en suivant les consignes du cours. Ne pousse jamais tes fichiers dans le dépôt du cours.

## Publication et données

Le site est publié sur GitHub Pages. Le workflow de redéploiement est manuel (`workflow_dispatch`) : un push de code ne publie pas automatiquement une nouvelle version.

Le site publié est un sous-ensemble construit par `course/scripts/build_site.py` : il ne contient que l'accueil, les modules 0 à 3, leurs ressources d'exercice et les réponses sous forme d'empreintes. Les scripts de test, outils de correction et documents enseignant ne font pas partie de cet artefact. La progression reste dans le stockage local du navigateur ; le cours ne demande pas de compte élève ni de données personnelles.

Le parcours contient des références à The Legend of Zelda dans un cadre pédagogique. Il s'agit d'un projet indépendant, non affilié à Nintendo et non approuvé par Nintendo.

## Installer les outils de base

L'accès au site publié ne demandera aucune installation. Pour les premières activités, prépare toutefois ces outils sur ton ordinateur :

1. **Un navigateur récent** : Firefox, Chrome ou Edge, avec une connexion Internet pour les exercices interactifs.
2. **Visual Studio Code** : [télécharger l'éditeur](https://code.visualstudio.com/download). Il servira à lire et modifier les fichiers du projet.
3. **Python 3** : [télécharger Python](https://www.python.org/downloads/). Sous Windows, coche **Add Python to PATH** si l'option est proposée. Les premiers exercices Python du site s'exécutent dans le navigateur ; l'installation locale sera utile pour les scripts des modules suivants.
4. **Git** : [télécharger Git](https://git-scm.com/downloads). Il permet de cloner et versionner ton dépôt individuel.
5. **Un tableur** pour le module 1 : **Excel de bureau** est l'outil recommandé, notamment pour Power Query et les tableaux croisés dynamiques. Si tu n'y as pas accès, LibreOffice Calc ou Google Sheets peuvent dépanner ; certaines consignes de nettoyage devront être adaptées.

Vérifie Python et Git depuis un terminal :

```powershell
# Windows
py --version
git --version

# macOS ou Linux
python3 --version
git --version
```

Tu dois obtenir un numéro de version pour chaque commande. Si une commande est introuvable, termine l'installation puis ouvre un nouveau terminal.

**Tu n'as pas besoin d'installer Node.js, npm, de paquets Python ou de logiciel SQL pour consulter le site et suivre les modules 0 à 3.** Les exercices Python, y compris les statistiques du module 3, et SQL s'exécutent dans le navigateur. Une connexion Internet est nécessaire pour charger Pyodide et ses bibliothèques. Ne télécharge pas d'outil ou d'extension payante sans vérifier avec ton enseignant.

## Ta progression

Ta progression est enregistrée dans le navigateur utilisé. Exporte régulièrement ta sauvegarde depuis le site et conserve-la dans un endroit privé. Ne partage pas ce fichier publiquement.

Les consignes propres à un exercice et à son livrable seront données dans le module correspondant.
