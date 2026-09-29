# Scénario de Démonstration - Registre de Traçabilité

Ce document présente un scénario structuré en 4 temps pour démontrer les fonctionnalités clés de l'application lors d'une présentation orale.

## Scénario en 4 Étapes

### Étape 1 : Enregistrement d'un lot incomplet par un technicien
- **Action** : Passer en rôle "Technicien" et créer un nouveau lot nommé "Glycémie — série incomplète"
- **Paramètres** : Sélectionner la machine "Cobas 8000", laisser le champ "Conditions" vide
- **Résultat attendu** : Le lot est créé mais apparaît avec le statut "À vérifier" (badge orange)

### Étape 2 : Signalement automatique
- **Action** : Observer la page "Signalements" 
- **Résultat attendu** : Un signalement automatique apparaît pour le lot incomplet : "Conditions non renseignées"
- **Point clé** : Le système détecte automatiquement les non-conformités et signale les lots qui nécessitent une attention

### Étape 3 : Correction et validation par un biologiste
- **Action** : 
  1. Passer en rôle "Biologiste"
  2. Ouvrir le lot "Glycémie — série incomplète"
  3. Cliquer sur "Modifier" (en tant que technicien) et ajouter les conditions : "Calibration matin, 21°C, contrôle interne passé"
  4. Passer en rôle "Biologiste" et valider le lot en sélectionnant "Dr. Amrani" dans la liste
- **Résultat attendu** : 
  - Le statut passe à "Conforme" (badge vert)
  - La validation apparaît dans l'historique avec le nom du biologiste et la date
  - Le signalement disparaît de la page "Signalements"

### Étape 4 : Consultation de la fiche de synthèse et mise à jour
- **Action** : Aller sur la page "Synthèse"
- **Résultat attendu** : La fiche de synthèse se met à jour automatiquement avec le lot nouvellement validé
- **Point clé** : La synthèse reflète en temps réel l'état de conformité du système

## Points à Mettre en Avance Pendant la Démo

### A. Données Médicales Crédibles
- Les lots utilisent de vrais paramètres de biologie médicale avec leurs unités :
  - Glycémie (g/L)
  - Créatinine (mg/L) 
  - CRP (mg/L)
  - Hémoglobine (g/dL)
  - TSH (mUI/L)
- Chaque lot affiche ses règles d'alerte avec seuils bas/haut et unités

### B. Conformité Réglementaire
- **ISO 15189** : Norme d'accréditation des laboratoires (COFRAC en France)
- **RGPD** : Pseudonymisation (remplacement par code) plutôt qu'anonymisation irréversible
- **AI Act** : Séparation claire des rôles technicien/biologiste

### C. Data Lineage Complet
- Chaque modification d'un lot est historisée (qui, quand, quoi)
- L'historique est consultable sur la fiche du lot sous forme de frise chronologique
- On peut remonter toute la vie du lot depuis sa création

### D. Processus de Validation
- Liste fixe de biologistes (Dr. Amrani, Dr. Chen, Dr. El Fassi)
- Validation impossible pour un technicien
- Chaque règle d'alerte est explicitement liée à son lot d'origine

## Données de Démo Préparées

L'application contient 16 lots de démonstration :
- **13 lots complets et validés** : Glycémie, HbA1c, NFS, Plaquettes, TSH, Troponine hs, CRP, Créatinine, Ionogramme, Bilan hépatique, Gaz du sang, Lactate, Hémocultures
- **3 lots incomplets** (pour montrer le signalement automatique) :
  - "Glycémie — série incomplète" (conditions manquantes)
  - "Créatinine — données manquantes" (date manquante)  
  - "Hémoglobine — sans validation" (pas de biologiste)

## Terminaison de la Présentation

Conclure sur la page **Conformité** en expliquant comment chaque choix technique répond à une vraie exigence :
- ISO 15189 → Traçabilité et validation des méthodes
- RGPD → Pseudonymisation et détection automatique des données identifiantes
- AI Act → Séparation des rôles et gouvernance des données
- Data lineage → Historisation complète pour audit

Cela montre que le projet n'est pas qu'un exercice de code, mais une vraie réflexion métier alignée sur les pratiques professionnelles des laboratoires de biologie médicale.
