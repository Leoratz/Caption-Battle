# 🎮 Caption Battle - Un jeu de mêmes en temps réel

## 👩‍💻 Membres du binôme
* [Alyssia LORSOLD PRADON](https://github.com/alyssialopr)
* [Léora CHRIQUI](https://github.com/Leoratz) 

## 🎯 Concept du jeu

**Caption Battle** est un jeu multijoueur en temps réel inspiré de "Make It Meme" où les joueurs s'affrontent pour créer les légendes les plus drôles sur des mèmes !

### 🎪 Comment ça marche ?

1. **📝 Phase de création** : Tous les joueurs voient le même mème et ont 30 secondes pour écrire une légende hilarante
2. **🗳️ Phase de vote** : Les légendes anonymes sont présentées et chaque joueur vote pour sa préférée (impossible de voter pour la sienne)
3. **🏆 Phase de résultats** : Points attribués selon le nombre de votes reçus, affichage du classement
4. **🔄 Rounds suivants** : Nouveau mème, nouvelles légendes, nouveaux rires !

Le gagnant est celui qui accumule le plus de points en créant les légendes les plus populaires !

### 🚪 Rejoindre une partie
1. Entrez votre **pseudo** (3-15 caractères)
2. Choisissez un **nom de salle** (3-20 caractères)
3. Cliquez sur **"Rejoindre"**


## ✨ Fonctionnalités

### 🎮 Gameplay
- **🖼️ Mèmes aléatoires** : Sélection automatique d'images depuis le dossier `/memes`
- **⏱️ Timer automatique** : 30s pour créer, 20s pour voter
- **🏅 Système de scoring** : Points basés sur les votes des autres joueurs
- **📊 Classement en temps réel** : Leaderboard mis à jour après chaque round
- **🎯 Mode démonstration** : Testez le jeu avec des bots simulés

### 🌐 Multijoueur
- **🚪 Salles privées** : Créez ou rejoignez des salles avec un nom personnalisé
- **👥 Gestion des joueurs** : Liste des joueurs connectés en temps réel
- **👑 Système d'hôte** : Le premier joueur contrôle le démarrage des parties
- **💬 Messages système** : Notifications quand des joueurs rejoignent/quittent
- **🔄 Synchronisation** : Tous les joueurs voient les mêmes phases simultanément

### 🛠️ Technique
- **⚡ Socket.IO** : Communication en temps réel entre client et serveur
- **🎲 Gestion d'état** : Synchronisation parfaite des phases de jeu
- **🔒 Validation** : Empêche les votes multiples et les actions invalides
- **📝 Logs détaillés** : Console de debug avec emojis pour le développement
- **🚀 Performance** : Chargement optimisé des ressources

## 🚀 Instructions pour lancer le projet

### 🌐 Version en ligne
Se rendre sur [CaptionBattle](https://caption-battle.onrender.com/)

## 🎯 Utilisation

## 🛠️ Technologies utilisées

- **Backend** : Node.js, Express.js, Socket.IO
- **Frontend** : JavaScript Vanilla, CSS3, HTML5
- **Temps réel** : WebSockets via Socket.IO
- **Déploiement** : Render.com


### 🚪 Écran de connexion
Interface simple pour rejoindre une salle avec pseudo et nom de salle.

### 🎮 Interface de jeu
Affichage du mème, timer, champ de saisie et liste des joueurs.

### 🗳️ Phase de vote
Présentation anonyme des légendes avec boutons de vote.

### 🏆 Résultats
Classement des joueurs et légende gagnante du round.

