/* langues.js — choix de la langue (français, anglais, espagnol).
   Le site est écrit en français. Quand on choisit une autre langue, ce script
   remplace les textes connus (menus, titres, boutons, explications principales)
   par leur traduction, y compris ceux qui apparaissent après coup.
   Les données elles-mêmes (noms de lots, de machines, valeurs) ne changent pas. */
(function () {
  const LANGUES = [
    { code: 'fr', nom: 'Français', court: 'FR' },
    { code: 'en', nom: 'English', court: 'EN' },
    { code: 'es', nom: 'Español', court: 'ES' }
  ];

  // [français, anglais, espagnol]
  const T = [
    // ---- Menu et barre du haut
    ['Comprendre', 'Understand', 'Comprender'],
    ['Le problème', 'The problem', 'El problema'],
    ['Accueil', 'Home', 'Inicio'],
    ['Tout le réseau', 'Whole network', 'Toda la red'],
    ['20 laboratoires', '20 laboratories', '20 laboratorios'],
    ['Labo de Nice en détail', 'Nice lab in detail', 'Laboratorio de Niza en detalle'],
    ['Lots de données', 'Data batches', 'Lotes de datos'],
    ['Machines', 'Analysers', 'Analizadores'],
    ['Alertes', 'Alerts', 'Alertas'],
    ['Patients', 'Patients', 'Pacientes'],
    ['Tableau de bord', 'Dashboard', 'Panel de control'],
    ['Preuves', 'Evidence', 'Pruebas'],
    ['Documents', 'Documents', 'Documentos'],
    ['Conformité', 'Compliance', 'Conformidad'],
    ['Admin', 'Admin', 'Administración'],
    ['Comptes', 'Accounts', 'Cuentas'],
    ['Journal', 'Audit log', 'Registro'],
    ['Déconnexion', 'Sign out', 'Cerrar sesión'],
    ['Compte', 'Account', 'Cuenta'],
    ['Lots, machines, PSN', 'Batches, analysers, PSN', 'Lotes, analizadores, PSN'],
    ['Langue', 'Language', 'Idioma'],
    ['Aucun résultat.', 'No results.', 'Sin resultados.'],

    // ---- Connexion
    ['Traçabilité des laboratoires d’analyses médicales', 'Traceability for medical testing laboratories', 'Trazabilidad para laboratorios de análisis clínicos'],
    ['Chaque lot garde sa mémoire', 'Every batch keeps its history', 'Cada lote conserva su historia'],
    ['Savoir d’où vient chaque donnée, quelle machine l’a mesurée, si elle est fiable et qui l’a validée.', 'Know where every piece of data comes from, which analyser measured it, whether it can be trusted and who approved it.', 'Saber de dónde viene cada dato, qué analizador lo midió, si es fiable y quién lo validó.'],
    ['Origine', 'Origin', 'Origen'],
    ['machine, date, conditions de mesure', 'analyser, date, measurement conditions', 'analizador, fecha, condiciones de medición'],
    ['Qualité', 'Quality', 'Calidad'],
    ['contrôles quotidiens, alertes automatiques', 'daily controls, automatic alerts', 'controles diarios, alertas automáticas'],
    ['Validation', 'Approval', 'Validación'],
    ['signée par un biologiste, tout est tracé', 'signed by a biologist, everything is traced', 'firmada por un biólogo, todo queda registrado'],
    ['laboratoires', 'laboratories', 'laboratorios'],
    ['machines suivies', 'analysers monitored', 'analizadores supervisados'],
    ['analyses', 'tests', 'análisis'],
    ['Connexion', 'Sign in', 'Iniciar sesión'],
    ['Connectez-vous pour accéder au registre.', 'Sign in to access the registry.', 'Inicie sesión para acceder al registro.'],
    ['Se connecter', 'Sign in', 'Iniciar sesión'],
    ['Créer un compte', 'Create an account', 'Crear una cuenta'],
    ['Identifiant ou e-mail', 'Username or e-mail', 'Usuario o correo'],
    ['Mot de passe', 'Password', 'Contraseña'],
    ['Afficher', 'Show', 'Mostrar'],
    ['Masquer', 'Hide', 'Ocultar'],
    ['Afficher le mot de passe', 'Show password', 'Mostrar contraseña'],
    ['Session de 8 h, déconnexion automatique.', '8-hour session, automatic sign-out.', 'Sesión de 8 h, cierre automático.'],
    ['Mot de passe oublié ?', 'Forgot password?', '¿Olvidó su contraseña?'],
    ['Comptes de démonstration', 'Demo accounts', 'Cuentas de demostración'],
    ['cliquez pour remplir', 'click to fill in', 'haga clic para rellenar'],
    ['Technicien', 'Technician', 'Técnico'],
    ['Biologiste', 'Biologist', 'Biólogo'],
    ['Client', 'Client', 'Cliente'],
    ['Samira K. · enregistre les lots', 'Samira K. · records batches', 'Samira K. · registra los lotes'],
    ['Dr. Amrani · valide lots et comptes', 'Dr. Amrani · approves batches and accounts', 'Dr. Amrani · valida lotes y cuentas'],
    ['Projet pédagogique : données fictives, aucun vrai patient.', 'Student project: fictitious data, no real patients.', 'Proyecto académico: datos ficticios, ningún paciente real.'],
    ['Nom affiché', 'Display name', 'Nombre visible'],
    ['Identifiant', 'Username', 'Usuario'],
    ['E-mail', 'E-mail', 'Correo'],
    ['Rôle demandé', 'Requested role', 'Rol solicitado'],
    ['Client (consultation)', 'Client (read only)', 'Cliente (consulta)'],
    ['Technicien (enregistre les lots)', 'Technician (records batches)', 'Técnico (registra lotes)'],
    ['Biologiste (valide lots et comptes)', 'Biologist (approves batches and accounts)', 'Biólogo (valida lotes y cuentas)'],
    ['Mot de passe (8 caractères min.)', 'Password (8 characters min.)', 'Contraseña (mín. 8 caracteres)'],
    ['Demander l’accès', 'Request access', 'Solicitar acceso'],
    ['Un biologiste devra valider le compte avant toute connexion.', 'A biologist must approve the account before it can be used.', 'Un biólogo debe validar la cuenta antes de cualquier conexión.'],
    ['Demander un lien (démo)', 'Request a link (demo)', 'Solicitar un enlace (demo)'],
    ['ex. samira.k', 'e.g. samira.k', 'p. ej. samira.k'],

    // ---- Accueil
    ['Bienvenue dans biologIA', 'Welcome to biologIA', 'Bienvenido a biologIA'],
    ['Pour chaque lot de mesures d’un laboratoire, on sait', 'For every batch of measurements in a laboratory, we know', 'Para cada lote de mediciones de un laboratorio, sabemos'],
    ['d’où il vient', 'where it comes from', 'de dónde viene'],
    ['quelle machine l’a produit', 'which analyser produced it', 'qué analizador lo produjo'],
    ['s’il est fiable', 'whether it is reliable', 'si es fiable'],
    ['qui l’a validé', 'who approved it', 'quién lo validó'],
    ['et', 'and', 'y'],
    ['Et si la machine d’analyse se trompait sans que personne ne le voie ?', 'What if the analyser were wrong and nobody noticed?', '¿Y si el analizador se equivocara sin que nadie lo notara?'],
    ['Les prises de sang servent à environ 70 % des diagnostics. Si une machine mesure faux pendant des semaines, des milliers de résultats partent faux, et on ne sait plus quelles données refaire.', 'Blood tests support about 70% of diagnoses. If an analyser measures wrongly for weeks, thousands of wrong results are sent out, and nobody knows which data to redo.', 'Los análisis de sangre intervienen en cerca del 70 % de los diagnósticos. Si un analizador mide mal durante semanas, miles de resultados salen erróneos y ya no se sabe qué datos rehacer.'],
    ['surveille chaque machine tous les jours, garde la trace de chaque donnée et dit tout de suite quoi refaire.', 'checks every analyser daily, keeps track of every piece of data and immediately says what to redo.', 'vigila cada analizador todos los días, registra cada dato e indica de inmediato qué rehacer.'],
    ['Comprendre le problème', 'Understand the problem', 'Entender el problema'],
    ['Notre réseau en chiffres', 'Our network in figures', 'Nuestra red en cifras'],
    ['laboratoires en région Sud', 'laboratories in southern France', 'laboratorios en el sur de Francia'],
    ['analyses (2025–2026)', 'tests (2025–2026)', 'análisis (2025–2026)'],
    ['contrôles de machines', 'analyser controls', 'controles de analizadores'],
    ['Voir les 20 laboratoires', 'See the 20 laboratories', 'Ver los 20 laboratorios'],
    ['Saisir', 'Record', 'Registrar'],
    ['Contrôler', 'Check', 'Controlar'],
    ['Valider', 'Approve', 'Validar'],
    ['Un technicien enregistre un lot : machine, date, conditions de mesure et fichier de mesures.', 'A technician records a batch: analyser, date, measurement conditions and data file.', 'Un técnico registra un lote: analizador, fecha, condiciones de medición y archivo de datos.'],
    ['Le site vérifie tout seul : données complètes, aucun nom de patient, valeurs dans les seuils.', 'The site checks automatically: complete data, no patient names, values within limits.', 'El sitio lo comprueba solo: datos completos, ningún nombre de paciente, valores dentro de los umbrales.'],
    ['Un biologiste valide ou signale le lot. Tout est tracé, daté et imprimable.', 'A biologist approves or flags the batch. Everything is traced, dated and printable.', 'Un biólogo valida o señala el lote. Todo queda registrado, fechado e imprimible.'],
    ['Où en est le laboratoire ?', 'Where does the laboratory stand?', '¿Cómo está el laboratorio?'],
    ['lots validés', 'batches approved', 'lotes validados'],
    ['pseudonymisés', 'pseudonymised', 'seudonimizados'],
    ['calibrations à jour', 'calibrations up to date', 'calibraciones al día'],
    ['Les mots à connaître', 'Key words', 'Palabras clave'],
    ['Lot', 'Batch', 'Lote'],
    ['une série de mesures d’une machine', 'a series of measurements from one analyser', 'una serie de mediciones de un analizador'],
    ['code qui replace le nom du patient', 'code that replaces the patient’s name', 'código que sustituye el nombre del paciente'],
    ['Carte de contrôle', 'Control chart', 'Gráfico de control'],
    ['courbe qui montre si une machine dérive', 'chart showing whether an analyser is drifting', 'curva que muestra si un analizador se desvía'],
    ['Signalement', 'Flag', 'Señalamiento'],
    ['anomalie repérée automatiquement', 'anomaly detected automatically', 'anomalía detectada automáticamente'],
    ['Panne (dérive)', 'Fault (drift)', 'Avería (deriva)'],
    ['machine qui se met à mesurer faux', 'analyser that starts measuring wrongly', 'analizador que empieza a medir mal'],
    ['Sigma', 'Sigma', 'Sigma'],
    ['note de fiabilité d’une machine (6 = excellent)', 'reliability score of an analyser (6 = excellent)', 'nota de fiabilidad de un analizador (6 = excelente)'],
    ['Plateau technique', 'Central laboratory', 'Laboratorio central'],
    ['gros labo qui fait les analyses spécialisées', 'large lab that runs specialised tests', 'laboratorio grande que realiza los análisis especializados'],
    ['Visite guidée (5 min)', 'Guided tour (5 min)', 'Visita guiada (5 min)'],
    ['Visite guidée', 'Guided tour', 'Visita guiada'],
    ['Ouvrir', 'Open', 'Abrir'],
    ['Le chemin conseillé pour comprendre biologIA en 5 minutes, par exemple pendant la présentation.', 'The recommended path to understand biologIA in 5 minutes, for example during the presentation.', 'El recorrido recomendado para entender biologIA en 5 minutos, por ejemplo durante la presentación.'],
    ['Les deux comptes, et ce qu’ils peuvent faire', 'The two accounts, and what they can do', 'Las dos cuentas y lo que pueden hacer'],
    ['Les 20 laboratoires du réseau', 'The network’s 20 laboratories', 'Los 20 laboratorios de la red'],
    ['Une panne repérée', 'A detected fault', 'Una avería detectada'],
    ['Un lot de données', 'A data batch', 'Un lote de datos'],
    ['Les alertes du labo', 'The lab’s alerts', 'Las alertas del laboratorio'],
    ['Les patients protégés', 'Protected patients', 'Los pacientes protegidos'],
    ['Les preuves à imprimer', 'Printable evidence', 'Las pruebas para imprimir'],
    ['Vérifier un fichier anonyme', 'Check an anonymous file', 'Verificar un archivo anónimo'],
    ['Vérifier qu’un fichier est vraiment anonyme', 'Check that a file is truly anonymous', 'Verificar que un archivo es realmente anónimo'],
    ['1. Le fichier préparé par le labo', '1. The file prepared by the lab', '1. El archivo preparado por el laboratorio'],
    ['2. Vérifier votre propre fichier', '2. Check your own file', '2. Verificar su propio archivo'],
    ['Préparer le fichier', 'Prepare the file', 'Preparar el archivo'],
    ['Le vérifier', 'Check it', 'Verificarlo'],
    ['Le télécharger (CSV)', 'Download it (CSV)', 'Descargarlo (CSV)'],
    ['Choisir un fichier .csv', 'Choose a .csv file', 'Elegir un archivo .csv'],
    ['Exemple correct', 'Correct example', 'Ejemplo correcto'],
    ['Exemple piège (avec des noms)', 'Trap example (with names)', 'Ejemplo trampa (con nombres)'],
    ['Contenu du fichier', 'File content', 'Contenido del archivo'],
    ['Vérifier ce fichier', 'Check this file', 'Verificar este archivo'],
    ['✓ Ce fichier peut être partagé', '✓ This file can be shared', '✓ Este archivo puede compartirse'],
    ['✗ Ce fichier ne doit pas être partagé', '✗ This file must not be shared', '✗ Este archivo no debe compartirse'],
    ['⚠ Impossible de vérifier ce fichier', '⚠ This file cannot be checked', '⚠ No se puede verificar este archivo'],
    ['Pas de nom, prénom, n° de sécurité sociale, e-mail ni téléphone', 'No surname, first name, social security number, e-mail or phone', 'Sin apellido, nombre, n.º de seguridad social, correo ni teléfono'],
    ['Pas de date de naissance complète', 'No full date of birth', 'Sin fecha de nacimiento completa'],
    ['Chaque profil (âge + sexe + lieu) concerne au moins 5 personnes', 'Each profile (age + sex + place) covers at least 5 people', 'Cada perfil (edad + sexo + lugar) abarca al menos 5 personas'],
    ['Impossible de retrouver l’identité à partir du fichier', 'Identity cannot be traced from the file', 'Imposible encontrar la identidad a partir del archivo'],
    ['Aucune colonne qui désigne une personne (nom, numéro, PSN…)', 'No column that designates a person (name, number, PSN…)', 'Ninguna columna que designe a una persona (nombre, número, PSN…)'],
    ['Aucun code patient (PSN) dans les valeurs', 'No patient code (PSN) in the values', 'Ningún código de paciente (PSN) en los valores'],
    ['Personne n’est reconnaissable en croisant âge, sexe et lieu', 'Nobody can be recognised by combining age, sex and place', 'Nadie es reconocible cruzando edad, sexo y lugar'],
    ['Lancer les vérifications', 'Run the checks', 'Ejecutar las verificaciones'],
    ['Ouvrir le tableau de bord', 'Open the dashboard', 'Abrir el panel de control'],

    ['À traiter', 'To do', 'Pendiente'],
    ['lots à valider', 'batches to approve', 'lotes por validar'],
    ['lots à revalider après une panne', 'batches to re-approve after a fault', 'lotes por revalidar tras una avería'],
    ['alertes ouvertes', 'open alerts', 'alertas abiertas'],
    ['machines à recalibrer', 'analysers to recalibrate', 'analizadores por recalibrar'],
    ['Le suivi des lots de données et des machines du laboratoire de Nice.', 'Tracking of data batches and analysers at the Nice laboratory.', 'Seguimiento de los lotes de datos y analizadores del laboratorio de Niza.'],
    ['Pointillés : lien vers le plateau technique qui fait les analyses spécialisées.', 'Dotted lines: link to the central lab that runs specialised tests.', 'Líneas punteadas: enlace al laboratorio central que realiza los análisis especializados.'],
    ['Janvier 2025 → octobre 2026.', 'January 2025 → October 2026.', 'Enero 2025 → octubre 2026.'],
    ['Barre : notre réseau en 2026. Trait gris : France entière (Assurance Maladie).', 'Bar: our network in 2026. Grey line: all of France (Health Insurance).', 'Barra: nuestra red en 2026. Línea gris: toda Francia (Seguro de Enfermedad).'],
    ['Échantillon anonymisé. Vert : normal · orange : trop bas · rouge : trop haut.', 'Anonymised sample. Green: normal · orange: too low · red: too high.', 'Muestra anonimizada. Verde: normal · naranja: demasiado bajo · rojo: demasiado alto.'],
    ['Note de fiabilité (Sigma) de chaque machine pour chaque analyse : 6 et plus = excellent, moins de 3 = trop d’erreurs.', 'Reliability score (Sigma) of each analyser for each test: 6 and above = excellent, below 3 = too many errors.', 'Nota de fiabilidad (Sigma) de cada analizador para cada análisis: 6 o más = excelente, menos de 3 = demasiados errores.'],
    ['Cliquez sur une case pour voir les contrôles de la machine.', 'Click a cell to see the analyser’s controls.', 'Haga clic en una casilla para ver los controles del analizador.'],
    ['Un point = un contrôle. Point rouge = alerte.', 'One dot = one control. Red dot = alert.', 'Un punto = un control. Punto rojo = alerta.'],
    ['Fréquence de contrôle conseillée selon la note de chaque machine.', 'Recommended control frequency based on each analyser’s score.', 'Frecuencia de control recomendada según la nota de cada analizador.'],
    ['Chaque mois, tous les labos analysent le même échantillon. Une ligne rouge = un labo toujours à l’écart.', 'Every month, all labs test the same sample. A red row = a lab that is always off.', 'Cada mes, todos los laboratorios analizan la misma muestra. Una fila roja = un laboratorio siempre desviado.'],
    ['Un lot par machine et par trimestre, validé par un biologiste.', 'One batch per analyser per quarter, approved by a biologist.', 'Un lote por analizador y trimestre, validado por un biólogo.'],
    ['CSV (séparateur « ; »), s’ouvre dans Excel.', 'CSV (“;” separator), opens in Excel.', 'CSV (separador «;»), se abre en Excel.'],
    ['Avant d’envoyer des résultats à l’extérieur (chercheurs, ARS…), on vérifie que personne ne peut être retrouvé. Rien n’est importé ni modifié.', 'Before sending results outside (researchers, health authorities…), we check that nobody can be identified. Nothing is imported or changed.', 'Antes de enviar resultados al exterior (investigadores, autoridades sanitarias…), se comprueba que nadie pueda ser identificado. No se importa ni modifica nada.'],
    ['sites de laboratoire pour 100 000 habitants en France', 'laboratory sites per 100,000 inhabitants in France', 'sitios de laboratorio por cada 100 000 habitantes en Francia'],
    // ---- Mots et boutons courants
    ['Enregistrer', 'Save', 'Guardar'],
    ['Annuler', 'Cancel', 'Cancelar'],
    ['Modifier', 'Edit', 'Editar'],
    ['Supprimer', 'Delete', 'Eliminar'],
    ['Retirer', 'Remove', 'Retirar'],
    ['Imprimer', 'Print', 'Imprimir'],
    ['Télécharger le PDF', 'Download PDF', 'Descargar PDF'],
    ['Fiche PDF', 'PDF sheet', 'Ficha PDF'],
    ['Exporter CSV', 'Export CSV', 'Exportar CSV'],
    ['Télécharger (CSV)', 'Download (CSV)', 'Descargar (CSV)'],
    ['Rechercher', 'Search', 'Buscar'],
    ['Voir', 'View', 'Ver'],
    ['Précédent', 'Previous', 'Anterior'],
    ['Suivant', 'Next', 'Siguiente'],
    ['Tous', 'All', 'Todos'],
    ['Effacer', 'Clear', 'Borrar'],
    ['Chargement…', 'Loading…', 'Cargando…'],
    ['+ Nouveau lot', '+ New batch', '+ Nuevo lote'],
    ['Nouveau lot', 'New batch', 'Nuevo lote'],
    ['Ajouter une machine', 'Add an analyser', 'Añadir un analizador'],
    ['← Retour au lot', '← Back to batch', '← Volver al lote'],
    ['Voir le calcul', 'See how it is calculated', 'Ver el cálculo'],
    ['Voir le détail', 'See details', 'Ver el detalle'],

    // ---- Statuts
    ['Validé', 'Approved', 'Validado'],
    ['Validés', 'Approved', 'Validados'],
    ['À valider', 'To approve', 'Por validar'],
    ['À revalider', 'To re-approve', 'Por revalidar'],
    ['Revalidé', 'Re-approved', 'Revalidado'],
    ['Revalidés', 'Re-approved', 'Revalidados'],
    ['Signalé', 'Flagged', 'Señalado'],
    ['Signalés', 'Flagged', 'Señalados'],
    ['Brouillon', 'Draft', 'Borrador'],
    ['Brouillons', 'Drafts', 'Borradores'],
    ['En service', 'In service', 'En servicio'],
    ['Maintenance', 'Maintenance', 'Mantenimiento'],
    ['Hors service', 'Out of service', 'Fuera de servicio'],
    ['Conforme', 'Compliant', 'Conforme'],
    ['Bon', 'Good', 'Bueno'],
    ['À surveiller', 'To watch', 'A vigilar'],
    ['Problème', 'Problem', 'Problema'],
    ['normal', 'normal', 'normal'],
    ['trop bas', 'too low', 'demasiado bajo'],
    ['trop haut', 'too high', 'demasiado alto'],
    ['oui', 'yes', 'sí'],
    ['non', 'no', 'no'],

    // ---- En-têtes de tableaux et libellés
    ['Machine', 'Analyser', 'Analizador'],
    ['Date', 'Date', 'Fecha'],
    ['Statut', 'Status', 'Estado'],
    ['Analyse', 'Test', 'Análisis'],
    ['Valeur', 'Value', 'Valor'],
    ['Résultat', 'Result', 'Resultado'],
    ['Laboratoire', 'Laboratory', 'Laboratorio'],
    ['État', 'Status', 'Estado'],
    ['Période', 'Period', 'Periodo'],
    ['Action', 'Action', 'Acción'],
    ['Cible', 'Target', 'Objetivo'],
    ['Qui', 'Who', 'Quién'],
    ['Utilisateur', 'User', 'Usuario'],
    ['Nom', 'Name', 'Nombre'],
    ['Âge', 'Age', 'Edad'],
    ['Femmes', 'Women', 'Mujeres'],
    ['Hommes', 'Men', 'Hombres'],
    ['Note /100', 'Score /100', 'Nota /100'],
    ['Note de confiance', 'Confidence score', 'Nota de confianza'],
    ['Pourquoi ?', 'Why?', '¿Por qué?'],
    ['Total', 'Total', 'Total'],
    ['Discipline', 'Discipline', 'Disciplina'],
    ['Fabricant', 'Manufacturer', 'Fabricante'],
    ['Secteur', 'Department', 'Sector'],
    ['Toutes les disciplines', 'All disciplines', 'Todas las disciplinas'],
    ['Tous les états', 'All statuses', 'Todos los estados'],
    ['Toutes les machines', 'All analysers', 'Todos los analizadores'],
    ['Tous les laboratoires', 'All laboratories', 'Todos los laboratorios'],
    ['Toutes les analyses', 'All tests', 'Todos los análisis'],
    ['Tous les statuts', 'All statuses', 'Todos los estados'],
    ['Calibration à renouveler', 'Calibration due', 'Calibración por renovar'],
    ['Lots produits', 'Batches produced', 'Lotes producidos'],
    ['Maintenance / hors service', 'Maintenance / out of service', 'Mantenimiento / fuera de servicio'],
    ['Rechercher (nom, fabricant, secteur)', 'Search (name, manufacturer, department)', 'Buscar (nombre, fabricante, sector)'],

    // ---- Titres de pages
    ['Lots', 'Batches', 'Lotes'],
    ['Patients et anonymisation', 'Patients and anonymisation', 'Pacientes y anonimización'],
    ['Identifier', 'Identify', 'Identificar'],
    ['Identifiants', 'Identifiers', 'Identificadores'],
    ['Anonymiser', 'Anonymise', 'Anonimizar'],
    ['Journal d’audit', 'Audit log', 'Registro de auditoría'],
    ['Certificat de traçabilité', 'Traceability certificate', 'Certificado de trazabilidad'],
    ['Certificats de traçabilité', 'Traceability certificates', 'Certificados de trazabilidad'],
    ['Fiche de synthèse', 'Summary sheet', 'Ficha de síntesis'],
    ['Cartes de contrôle', 'Control charts', 'Gráficos de control'],
    ['Parcours (lignée)', 'Data lineage', 'Recorrido (linaje)'],
    ['Ouvrir la lignée', 'Open the lineage', 'Abrir el linaje'],

    // ---- Page réseau
    ['Réseau biologIA Sud · Provence-Alpes-Côte d’Azur', 'biologIA South network · Provence-Alpes-Côte d’Azur', 'Red biologIA Sur · Provenza-Alpes-Costa Azul'],
    ['Le réseau de laboratoires', 'The laboratory network', 'La red de laboratorios'],
    ['C’est quoi le problème ?', 'What is the problem?', '¿Cuál es el problema?'],
    ['En bref', 'Overview', 'Resumen'],
    ['Carte', 'Map', 'Mapa'],
    ['Activité', 'Activity', 'Actividad'],
    ['Données', 'Data', 'Datos'],
    ['En clair :', 'In short:', 'En pocas palabras:'],
    ['biologIA, c’est le', 'biologIA is the', 'biologIA es el'],
    ['carnet de santé', 'health record', 'historial clínico'],
    ['des machines et des données d’un réseau de laboratoires. Il vérifie chaque jour que les machines mesurent juste et, si l’une se trompe, il dit tout de suite quelles données refaire.', 'of the analysers and data of a laboratory network. It checks every day that the analysers measure correctly and, if one goes wrong, immediately says which data to redo.', 'de los analizadores y datos de una red de laboratorios. Comprueba cada día que los analizadores miden bien y, si uno se equivoca, indica de inmediato qué datos rehacer.'],
    ['Laboratoires', 'Laboratories', 'Laboratorios'],
    ['Analyses', 'Tests', 'Análisis'],
    ['Machines surveillées', 'Analysers monitored', 'Analizadores supervisados'],
    ['Pannes détectées', 'Faults detected', 'Averías detectadas'],
    ['Ce que biologIA change', 'What biologIA changes', 'Lo que cambia biologIA'],
    ['Voir les pannes', 'See the faults', 'Ver las averías'],
    ['Comment ça marche, en 3 étapes', 'How it works, in 3 steps', 'Cómo funciona, en 3 pasos'],
    ['Chaque matin', 'Every morning', 'Cada mañana'],
    ['Il retrouve', 'It finds', 'Encuentra'],
    ['Les laboratoires, du meilleur au moins bon', 'Laboratories, from best to worst', 'Los laboratorios, del mejor al peor'],
    ['Comment la note sur 100 est calculée ?', 'How is the score out of 100 calculated?', '¿Cómo se calcula la nota sobre 100?'],
    ['(cliquez)', '(click)', '(haga clic)'],
    ['laboratoire de proximité', 'local laboratory', 'laboratorio de proximidad'],
    ['gros laboratoire (plateau technique)', 'large laboratory (central lab)', 'laboratorio grande (laboratorio central)'],
    ['rien à signaler', 'nothing to report', 'nada que señalar'],
    ['Nombre d’analyses par mois', 'Number of tests per month', 'Número de análisis por mes'],
    ['Quelles analyses ? Réseau comparé à la France', 'Which tests? Network compared with France', '¿Qué análisis? Red comparada con Francia'],
    ['Combien coûte une analyse ?', 'How much does a test cost?', '¿Cuánto cuesta un análisis?'],
    ['Analyses par département', 'Tests by department', 'Análisis por departamento'],
    ['Résultats des patients (anonymisés)', 'Patient results (anonymised)', 'Resultados de los pacientes (anonimizados)'],
    ['Notre réseau', 'Our network', 'Nuestra red'],
    ['France', 'France', 'Francia'],
    ['résultats', 'results', 'resultados'],
    ['normaux', 'normal', 'normales'],
    ['trop hauts', 'too high', 'demasiado altos'],
    ['Moyenne selon l’âge et le sexe', 'Average by age and sex', 'Media según la edad y el sexo'],
    ['La note de chaque analyse, dans chaque laboratoire', 'The score of each test, in each laboratory', 'La nota de cada análisis, en cada laboratorio'],
    ['Les contrôles de la machine, jour par jour', 'The analyser’s controls, day by day', 'Los controles del analizador, día a día'],
    ['3 mois', '3 months', '3 meses'],
    ['6 mois', '6 months', '6 meses'],
    ['Tout', 'All', 'Todo'],
    ['Contrôle bas', 'Low control', 'Control bajo'],
    ['Contrôle haut', 'High control', 'Control alto'],
    ['Alerte', 'Alert', 'Alerta'],
    ['cible', 'target', 'objetivo'],
    ['panne', 'fault', 'avería'],
    ['fin du mois', 'end of month', 'fin de mes'],
    ['Pour aller plus loin : ce qu’il faut faire, machine par machine', 'Going further: what to do, analyser by analyser', 'Para ir más lejos: qué hacer, analizador por analizador'],
    ['Un laboratoire qui mesure toujours un peu à côté', 'A laboratory that always measures slightly off', 'Un laboratorio que siempre mide un poco desviado'],
    ['D’où viennent les données ?', 'Where does the data come from?', '¿De dónde vienen los datos?'],
    ['Les lots de référence', 'Reference batches', 'Los lotes de referencia'],
    ['Tous les jeux de données', 'All datasets', 'Todos los conjuntos de datos'],
    ['vrai', 'real', 'real'],
    ['simulé', 'simulated', 'simulado'],
    ['référentiel', 'reference', 'referencia'],
    ['réel', 'real', 'real'],
    ['vert', 'green', 'verde'],
    ['orange', 'orange', 'naranja'],
    ['rouge', 'red', 'rojo'],

    // ---- Page Problématique
    ['Un résultat d’analyse ne vaut que ce que valent les données qui l’ont jugé « normal ».', 'A test result is only as good as the data that judged it “normal”.', 'Un resultado de análisis solo vale lo que valen los datos que lo consideraron «normal».'],
    ['Comment un réseau de laboratoires peut-il prouver, à tout moment, que ses seuils d’alerte reposent sur des données fiables, traçables et conformes ?', 'How can a laboratory network prove, at any time, that its alert thresholds rely on reliable, traceable and compliant data?', '¿Cómo puede una red de laboratorios demostrar, en todo momento, que sus umbrales de alerta se basan en datos fiables, trazables y conformes?'],
    ['En une image :', 'In one picture:', 'En una imagen:'],
    ['Le contexte en chiffres (données publiques)', 'The context in figures (public data)', 'El contexto en cifras (datos públicos)'],
    ['Le problème, en trois points', 'The problem, in three points', 'El problema, en tres puntos'],
    ['Des données sans mémoire', 'Data without history', 'Datos sin memoria'],
    ['Des pannes vues trop tard', 'Faults seen too late', 'Averías detectadas demasiado tarde'],
    ['Des sites qui ne se comparent pas', 'Sites that do not compare themselves', 'Sitios que no se comparan'],
    ['Notre solution : biologIA', 'Our solution: biologIA', 'Nuestra solución: biologIA'],
    ['Un registre qui garde la mémoire', 'A registry that keeps the history', 'Un registro que conserva la memoria'],
    ['Une surveillance quotidienne', 'Daily monitoring', 'Una vigilancia diaria'],
    ['Un observatoire du réseau', 'A network observatory', 'Un observatorio de la red'],
    ['Ce que ça change (simulation sur le réseau biologIA Sud)', 'What it changes (simulation on the biologIA South network)', 'Lo que cambia (simulación en la red biologIA Sur)'],
    ['Sans registre', 'Without the registry', 'Sin registro'],
    ['Avec biologIA', 'With biologIA', 'Con biologIA'],
    ['Pour qui ?', 'For whom?', '¿Para quién?'],
    ['Direction qualité', 'Quality management', 'Dirección de calidad'],
    ['Auditeur (Cofrac, ARS)', 'Auditor (Cofrac, ARS)', 'Auditor (Cofrac, ARS)'],
    ['Cadre réglementaire couvert', 'Regulatory framework covered', 'Marco normativo cubierto'],
    ['Nos données et nos limites, en toute honnêteté', 'Our data and our limits, in all honesty', 'Nuestros datos y nuestros límites, con total honestidad'],
    ['Ce qui vient de sources officielles', 'What comes from official sources', 'Lo que viene de fuentes oficiales'],
    ['Ce que nous avons fabriqué', 'What we created', 'Lo que hemos creado'],
    ['Ce que l’outil ne fait pas', 'What the tool does not do', 'Lo que la herramienta no hace'],
    ['Pour un vrai déploiement', 'For a real deployment', 'Para un despliegue real'],
    ['limite', 'limit', 'límite'],
    ['suite', 'next', 'siguiente'],
    ['Explorer l’observatoire', 'Explore the observatory', 'Explorar el observatorio'],

    // ---- Lots, machines, patients
    ['Rechercher un lot', 'Search for a batch', 'Buscar un lote'],
    ['Plus récents', 'Most recent', 'Más recientes'],
    ['Cartes', 'Cards', 'Tarjetas'],
    ['Tableau', 'Table', 'Tabla'],
    ['Comment est-elle calculée ?', 'How is it calculated?', '¿Cómo se calcula?'],
    ['Total sur 100.', 'Total out of 100.', 'Total sobre 100.'],
    ['Ses mesures', 'Their measurements', 'Sus mediciones'],
    ['Voir tous les patients', 'See all patients', 'Ver todos los pacientes'],
    ['Résumé', 'Summary', 'Resumen'],
    ['Historique', 'History', 'Historial'],
    ['Règles d’alerte', 'Alert rules', 'Reglas de alerta'],
    ['Validations', 'Approvals', 'Validaciones'],
    ['Signalements', 'Flags', 'Señalamientos'],
    ['Aucun signalement ouvert', 'No open flags', 'Ningún señalamiento abierto'],
    ['Machine renseignée', 'Analyser provided', 'Analizador indicado'],
    ['Date de mesure renseignée', 'Measurement date provided', 'Fecha de medición indicada'],
    ['Conditions de mesure renseignées', 'Measurement conditions provided', 'Condiciones de medición indicadas'],
    ['Pseudonymisation confirmée, sans colonne identifiante', 'Pseudonymisation confirmed, no identifying column', 'Seudonimización confirmada, sin columna identificativa'],
    ['Validation biologiste à jour (moins de 12 mois)', 'Biologist approval up to date (under 12 months)', 'Validación del biólogo al día (menos de 12 meses)']    ,
    // ---- Disciplines et secteurs
    ['Biochimie', 'Biochemistry', 'Bioquímica'],
    ['Hématologie', 'Haematology', 'Hematología'],
    ['Hémostase', 'Haemostasis', 'Hemostasia'],
    ['Biologie moléculaire', 'Molecular biology', 'Biología molecular'],
    ['Pré-analytique', 'Pre-analytics', 'Preanalítica'],
    ['Électrophorèse', 'Electrophoresis', 'Electroforesis'],
    ['Gaz du sang', 'Blood gases', 'Gases en sangre'],
    ['Hémocultures', 'Blood cultures', 'Hemocultivos'],
    ['Microbiologie', 'Microbiology', 'Microbiología'],
    ['Immunologie', 'Immunology', 'Inmunología'],
    ['Sérologie', 'Serology', 'Serología'],
    ['Réanimation', 'Intensive care', 'Reanimación'],
    ['Protéines', 'Proteins', 'Proteínas'],
    ['Biochimie – chaîne principale', 'Biochemistry – main line', 'Bioquímica – cadena principal'],
    ['Hématologie – secours', 'Haematology – backup', 'Hematología – respaldo'],
    ['Sérologies – vitamine D', 'Serology – vitamin D', 'Serologías – vitamina D'],
    ['HbA1c (diabète)', 'HbA1c (diabetes)', 'HbA1c (diabetes)'],
    ['Glycémie à jeun', 'Fasting glucose', 'Glucemia en ayunas'],
    ['Les automates du plateau technique de Nice : qui les fabrique, où ils sont, s’ils sont en service et combien de lots ils ont produits.', 'The analysers of the Nice central lab: who makes them, where they are, whether they are in service and how many batches they produced.', 'Los analizadores del laboratorio central de Niza: quién los fabrica, dónde están, si están en servicio y cuántos lotes han producido.'],

    // ---- Réseau, suite
    ['Chiffres calés sur des données officielles · voir « Données »', 'Figures aligned with official data · see “Data”', 'Cifras ajustadas a datos oficiales · ver «Datos»'],
    ['Pendant les 8 pannes de mesure, combien de résultats de patients sont partis faux ?', 'During the 8 measurement faults, how many patient results went out wrong?', 'Durante las 8 averías de medición, ¿cuántos resultados de pacientes salieron erróneos?'],
    ['Sans biologIA (on vérifie une fois par mois)', 'Without biologIA (checked once a month)', 'Sin biologIA (se comprueba una vez al mes)'],
    ['Avec biologIA (on vérifie chaque jour)', 'With biologIA (checked every day)', 'Con biologIA (se comprueba cada día)'],
    [', chaque machine analyse 2 échantillons dont on connaît déjà le résultat (les « contrôles »).', ', each analyser tests 2 samples whose result is already known (the “controls”).', ', cada analizador analiza 2 muestras cuyo resultado ya se conoce (los «controles»).'],
    ['biologIA compare', 'biologIA compares', 'biologIA compara'],
    [': si la machine s’écarte trop de la bonne réponse, il lance une alerte.', ': if the analyser strays too far from the right answer, it raises an alert.', ': si el analizador se aleja demasiado de la respuesta correcta, lanza una alerta.'],
    ['toutes les données produites pendant la panne et les met « à revalider ». Un biologiste décide.', 'all the data produced during the fault and marks it “to re-approve”. A biologist decides.', 'todos los datos producidos durante la avería y los marca «por revalidar». Un biólogo decide.'],
    ['50 points : fiabilité des machines.', '50 points: analyser reliability.', '50 puntos: fiabilidad de los analizadores.'],
    ['30 points : accord avec les autres labos.', '30 points: agreement with other labs.', '30 puntos: concordancia con los demás laboratorios.'],
    ['20 points : lots à jour.', '20 points: batches up to date.', '20 puntos: lotes al día.'],
    ['Moyenne des notes Sigma du labo. Une moyenne de 6 ou plus donne les 50 points ; 3 donne 25 points.', 'Average of the lab’s Sigma scores. An average of 6 or more gives 50 points; 3 gives 25 points.', 'Media de las notas Sigma del laboratorio. Una media de 6 o más da los 50 puntos; 3 da 25 puntos.'],
    ['Écart moyen (|z|) aux campagnes communes. 0 d’écart = 30 points ; un écart de 1,5 ou plus = 0.', 'Average gap (|z|) in shared campaigns. No gap = 30 points; a gap of 1.5 or more = 0.', 'Desviación media (|z|) en las campañas comunes. Sin desviación = 30 puntos; una de 1,5 o más = 0.'],
    ['20 si tout est validé, 16 si des lots attendent une validation, 6 si un lot doit être revalidé après une panne.', '20 if everything is approved, 16 if batches await approval, 6 if a batch must be re-approved after a fault.', '20 si todo está validado, 16 si hay lotes pendientes, 6 si un lote debe revalidarse tras una avería.'],
    ['État :', 'Status:', 'Estado:'],
    ['une machine peu fiable', 'one unreliable analyser', 'un analizador poco fiable'],
    ['machines moyennement fiables', 'moderately reliable analysers', 'analizadores medianamente fiables'],
    ['écart avec les autres labos', 'gap with other labs', 'desviación respecto a otros laboratorios'],
    ['134 k contrôles vérifiés', '134 k controls checked', '134 k controles verificados'],
    ['repérées en 4,5 jours en moyenne', 'spotted in 4.5 days on average', 'detectadas en 4,5 días de media'],
    ['76 % de résultats faux en moins.', '76% fewer wrong results.', '76 % menos resultados erróneos.']    ,
    // ---- Page Problématique, textes simples
    ['Projet 4 · Biologie / Laboratoires · BUT Science des Données', 'Project 4 · Biology / Laboratories · Data Science degree (BUT)', 'Proyecto 4 · Biología / Laboratorios · Grado en Ciencia de Datos (BUT)'],
    ['des démarches diagnostiques s’appuient sur la biologie médicale', 'of diagnostic pathways rely on medical biology', 'de los procesos diagnósticos se apoyan en la biología médica'],
    ['actes de biologie remboursés en France de janvier à juin 2026 (1,9 Md€)', 'lab tests reimbursed in France from January to June 2026 (€1.9 bn)', 'actos de biología reembolsados en Francia de enero a junio de 2026 (1.900 M€)'],
    ['sites de laboratoire pour 100 000 habitants en moyenne en France', 'laboratory sites per 100,000 inhabitants on average in France', 'sitios de laboratorio por cada 100 000 habitantes de media en Francia'],
    ['des examens doivent être accrédités ISO 15189 par le Cofrac', 'of tests must be ISO 15189 accredited by Cofrac', 'de los análisis deben estar acreditados ISO 15189 por el Cofrac'],
    ['Rapport IGF / IGAS, mai 2025', 'IGF / IGAS report, May 2025', 'Informe IGF / IGAS, mayo de 2025'],
    ['Assurance Maladie (Cnam), séries mensuelles 2026', 'French Health Insurance (Cnam), monthly series 2026', 'Seguro de Enfermedad (Cnam), series mensuales 2026'],
    ['ARS Île-de-France, PRS 2023-2028 (source SI BIO2)', 'ARS Île-de-France, PRS 2023-2028 (source: SI BIO2)', 'ARS Île-de-France, PRS 2023-2028 (fuente SI BIO2)'],
    ['Ordonnance n° 2010-49 du 13 janvier 2010', 'Ordinance no. 2010-49 of 13 January 2010', 'Ordenanza n.º 2010-49 del 13 de enero de 2010'],
    ['Aucun lien entre une panne et les données qu’elle a faussées.', 'No link between a fault and the data it distorted.', 'Ningún vínculo entre una avería y los datos que ha falseado.'],
    ['Biais systématiques entre sites invisibles (aucune vue réseau).', 'Systematic biases between sites go unseen (no network view).', 'Sesgos sistemáticos entre sitios invisibles (sin visión de red).'],
    ['Pour un auditeur : retrouver l’origine d’un seuil prend des heures, voire est impossible.', 'For an auditor: tracing a threshold back to its origin takes hours, or is impossible.', 'Para un auditor: rastrear el origen de un umbral lleva horas, o es imposible.'],
    ['Enregistre les lots, voit tout de suite ce qui manque ou ce qui cloche.', 'Records batches, sees right away what is missing or wrong.', 'Registra los lotes y ve enseguida lo que falta o falla.'],
    ['Valide les lots et les règles d’alerte, signe, garde la décision finale (le logiciel ne décide jamais seul).', 'Approves batches and alert rules, signs, keeps the final decision (the software never decides alone).', 'Valida los lotes y las reglas de alerta, firma y conserva la decisión final (el software nunca decide solo).'],
    ['Pilote le réseau : fiabilité des machines, pannes, écarts entre labos, lots à revalider.', 'Steers the network: analyser reliability, faults, gaps between labs, batches to re-approve.', 'Dirige la red: fiabilidad de los analizadores, averías, desviaciones entre laboratorios, lotes por revalidar.'],
    ['Remonte la lignée d’un seuil jusqu’aux données brutes, avec le certificat et le journal d’audit.', 'Traces a threshold back to the raw data, with the certificate and the audit log.', 'Rastrea el linaje de un umbral hasta los datos brutos, con el certificado y el registro de auditoría.'],
    ['Traçabilité des examens, maîtrise des équipements, contrôle qualité interne et externe, enregistrements.', 'Test traceability, equipment control, internal and external quality control, records.', 'Trazabilidad de los análisis, control de equipos, control de calidad interno y externo, registros.'],
    ['Pseudonymisation (code PSN), détection des colonnes identifiantes, test de k-anonymat (k ≥ 5) avant tout partage.', 'Pseudonymisation (PSN code), detection of identifying columns, k-anonymity test (k ≥ 5) before any sharing.', 'Seudonimización (código PSN), detección de columnas identificativas, prueba de k-anonimato (k ≥ 5) antes de compartir.'],
    ['Les alertes sont des aides : la validation reste humaine et chaque décision est journalisée.', 'Alerts are aids: approval remains human and every decision is logged.', 'Las alertas son ayudas: la validación sigue siendo humana y cada decisión queda registrada.'],
    ['Le nombre d’analyses et leur prix remboursé en France (Assurance Maladie, janvier–juin 2026, 14 codes d’analyses).', 'The number of tests and their reimbursed price in France (Health Insurance, January–June 2026, 14 test codes).', 'El número de análisis y su precio reembolsado en Francia (Seguro de Enfermedad, enero–junio 2026, 14 códigos de análisis).'],
    ['Les villes, leurs codes et leur nombre d’habitants (INSEE).', 'Cities, their codes and population (INSEE).', 'Las ciudades, sus códigos y su número de habitantes (INSEE).'],
    ['Les contours des départements sur la carte (IGN).', 'Department boundaries on the map (IGN).', 'Los contornos de los departamentos en el mapa (IGN).'],
    ['Les règles de contrôle qualité (règles de Westgard, méthode Sigma) : méthodes utilisées dans les vrais laboratoires.', 'Quality control rules (Westgard rules, Sigma method): methods used in real laboratories.', 'Las reglas de control de calidad (reglas de Westgard, método Sigma): métodos usados en laboratorios reales.'],
    ['Les 20 laboratoires, leurs 43 machines, les contrôles, les pannes et les résultats de patients.', 'The 20 laboratories, their 43 analysers, the controls, the faults and the patient results.', 'Los 20 laboratorios, sus 43 analizadores, los controles, las averías y los resultados de pacientes.'],
    ['Aucun vrai patient, aucun vrai laboratoire.', 'No real patients, no real laboratories.', 'Ningún paciente real, ningún laboratorio real.'],
    ['Les limites « normal / anormal » sont les valeurs usuelles des manuels, légèrement ajustées par machine ; un vrai labo les adapterait à sa population (âge, sexe).', 'The “normal / abnormal” limits are the usual textbook values, slightly adjusted per analyser; a real lab would adapt them to its population (age, sex).', 'Los límites «normal / anormal» son los valores habituales de los manuales, ligeramente ajustados por analizador; un laboratorio real los adaptaría a su población (edad, sexo).'],
    ['Les données sont saisies ou importées en CSV : pas encore de connexion directe aux machines.', 'Data is entered or imported as CSV: no direct connection to analysers yet.', 'Los datos se introducen o importan en CSV: todavía no hay conexión directa con los analizadores.'],
    ['Brancher les machines directement (normes HL7 / ASTM).', 'Connect analysers directly (HL7 / ASTM standards).', 'Conectar los analizadores directamente (normas HL7 / ASTM).'],
    ['Importer les vrais rapports de comparaison entre laboratoires (organismes d’évaluation externe).', 'Import real inter-laboratory comparison reports (external assessment bodies).', 'Importar los informes reales de comparación entre laboratorios (organismos de evaluación externa).'],
    ['Héberger les données de santé chez un hébergeur certifié HDS.', 'Host health data with an HDS-certified provider.', 'Alojar los datos de salud en un proveedor certificado HDS.'],
    ['Faire tester l’outil par des techniciens et des biologistes.', 'Have technicians and biologists test the tool.', 'Hacer que técnicos y biólogos prueben la herramienta.'],
    ['Sources : IGF-IGAS, « Pertinence et efficience des dépenses de biologie médicale » (mai 2025) ; Assurance Maladie, remboursements de biologie 2026 ; ARS Île-de-France, schéma régional de santé 2023-2028 ; ordonnance n° 2010-49 du 13 janvier 2010 relative à la biologie médicale.', 'Sources: IGF-IGAS, “Relevance and efficiency of medical biology spending” (May 2025); French Health Insurance, biology reimbursements 2026; ARS Île-de-France, regional health plan 2023-2028; ordinance no. 2010-49 of 13 January 2010 on medical biology.', 'Fuentes: IGF-IGAS, «Pertinencia y eficiencia del gasto en biología médica» (mayo de 2025); Seguro de Enfermedad, reembolsos de biología 2026; ARS Île-de-France, plan regional de salud 2023-2028; ordenanza n.º 2010-49 del 13 de enero de 2010 sobre biología médica.'],
    ['Créer', 'Create', 'Crear'],
    ['Numéro patient', 'Patient number', 'Número de paciente'],
    ['Saisissez un numéro ou un nom pour afficher le PSN.', 'Enter a number or a name to display the PSN.', 'Introduzca un número o un nombre para mostrar el PSN.'],
    ['Fiche de synthèse, certificats de traçabilité et parcours des lots.', 'Summary sheet, traceability certificates and batch lineage.', 'Ficha de síntesis, certificados de trazabilidad y recorrido de los lotes.'],
    ['lots enregistrés', 'batches recorded', 'lotes registrados'],
    ['validés', 'approved', 'validados'],
    ['Les 7 étapes d’un lot, de la mesure à la validation.', 'The 7 steps of a batch, from measurement to approval.', 'Los 7 pasos de un lote, de la medición a la validación.']    ,
    ['Vérifier la chaîne de hachage', 'Verify the hash chain', 'Verificar la cadena de hash'],
    ['Toutes les actions', 'All actions', 'Todas las acciones'],
    ['création lot', 'batch created', 'creación de lote'],
    ['Accorder, refuser ou confirmer un rôle. Aucune identité patient ici.', 'Grant, refuse or confirm a role. No patient identity here.', 'Conceder, rechazar o confirmar un rol. Aquí no hay identidades de pacientes.'],
    ['Changer le rôle', 'Change role', 'Cambiar el rol'],
    ['Anomalies automatiques. Clôture après correction ou justification.', 'Automatic anomalies. Closed after correction or justification.', 'Anomalías automáticas. Se cierran tras corrección o justificación.'],
    ['Résolus', 'Resolved', 'Resueltos'],
    ['Ouverts', 'Open', 'Abiertos'],
    ['Clôturer (biologiste)', 'Close (biologist)', 'Cerrar (biólogo)'],
    ['Conditions de mesure non renseignées', 'Measurement conditions missing', 'Condiciones de medición no indicadas'],
    ['Pseudonymisation non confirmée', 'Pseudonymisation not confirmed', 'Seudonimización no confirmada'],
    ['Série trop courte pour une carte de contrôle (moins de 20 points).', 'Series too short for a control chart (fewer than 20 points).', 'Serie demasiado corta para un gráfico de control (menos de 20 puntos).'],
    ['Ouvrez un lot pour le valider.', 'Open a batch to approve it.', 'Abra un lote para validarlo.'],
    ['note de confiance sur 100', 'confidence score out of 100', 'nota de confianza sobre 100'],
    ['Machine renseignée :', 'Analyser provided:', 'Analizador indicado:'],
    ['Patients pseudonymisés, aucune colonne avec un nom :', 'Patients pseudonymised, no column with a name:', 'Pacientes seudonimizados, ninguna columna con nombre:'],
    ['Aucun identifiant de lot n\'a été fourni.', 'No batch identifier was provided.', 'No se ha indicado ningún identificador de lote.'],
    ['Aucune machine indiquée.', 'No analyser specified.', 'Ningún analizador indicado.'],
    ['Détail technique', 'Technical details', 'Detalle técnico'],
    ['Protection des patients', 'Patient protection', 'Protección de los pacientes'],
    ['Traçabilité (esprit ISO 15189)', 'Traceability (ISO 15189 spirit)', 'Trazabilidad (espíritu ISO 15189)'],
    ['Le site ne pose aucun diagnostic et ne remplace pas un biologiste : il signale, un humain décide.', 'The site makes no diagnosis and does not replace a biologist: it flags, a human decides.', 'El sitio no emite ningún diagnóstico ni sustituye a un biólogo: señala, y un humano decide.'],
    ['Ce que le site protège, et ce qu’il ne garantit pas encore. Chaque état est calculé à partir d’un vrai contrôle, pas écrit à la main.', 'What the site protects, and what it does not yet guarantee. Each status is calculated from a real check, not written by hand.', 'Lo que el sitio protege y lo que todavía no garantiza. Cada estado se calcula a partir de un control real, no se escribe a mano.'],
    ['Chacun n’accède qu’à ce que son rôle autorise, et le serveur le vérifie à chaque requête : masquer un bouton ne suffirait pas.', 'Everyone only accesses what their role allows, and the server checks it on every request: hiding a button would not be enough.', 'Cada uno solo accede a lo que su rol permite, y el servidor lo comprueba en cada petición: ocultar un botón no bastaría.'],
    ['Chaque action est enregistrée avec son auteur et sa date. Modifier une ligne après coup se verrait immédiatement.', 'Every action is recorded with its author and date. Changing a line afterwards would be seen immediately.', 'Cada acción se registra con su autor y su fecha. Modificar una línea después se notaría de inmediato.']
  ];

  // Paragraphes entiers (avec gras ou liens) : [texte français, html anglais, html espagnol]
  const BLOCS = [
    ['En une image : une machine d’analyse, c’est comme une balance de cuisine. Si elle est mal réglée de 100 g, tout ce qu’on pèse est faux, même la recette « de référence » qu’on a notée ce jour-là. biologIA vérifie la balance chaque matin, et si elle s’est déréglée, il retrouve toutes les recettes à refaire.',
     '<b>In one picture:</b> an analyser is like a <b>kitchen scale</b>. If it is off by 100 g, everything you weigh is wrong, even the “reference” recipe you wrote down that day. biologIA checks the scale every morning and, if it has drifted, finds every recipe that needs redoing.',
     '<b>En una imagen:</b> un analizador es como una <b>báscula de cocina</b>. Si está desajustada 100 g, todo lo que se pesa es erróneo, incluso la receta «de referencia» anotada ese día. biologIA comprueba la báscula cada mañana y, si se ha desajustado, encuentra todas las recetas que hay que rehacer.'],
    ['Chaque laboratoire fixe des seuils d’alerte (au-dessus de telle valeur, le résultat est signalé au médecin). Ces seuils sont calculés à partir de lots de données de référence. Si ces lots ont été produits par une machine qui mesurait faux, ou contiennent des données mal anonymisées, toute la chaîne est fragilisée — sans que personne ne le voie.',
     'Every laboratory sets alert thresholds (above a given value, the result is flagged to the doctor). These thresholds are calculated from <b>reference data batches</b>. If those batches were produced by an analyser that was measuring wrongly, or contain poorly anonymised data, the whole chain is weakened — without anyone noticing.',
     'Cada laboratorio fija umbrales de alerta (por encima de cierto valor, el resultado se señala al médico). Estos umbrales se calculan a partir de <b>lotes de datos de referencia</b>. Si esos lotes fueron producidos por un analizador que medía mal, o contienen datos mal anonimizados, toda la cadena se debilita — sin que nadie lo note.'],
    ['Un fichier de référence circule entre tableurs et e-mails. Six mois plus tard, on ne sait plus quelle machine l’a produit, dans quelles conditions, ni qui l’a validé. Impossible de le prouver à un auditeur.',
     'A reference file circulates between spreadsheets and e-mails. Six months later, nobody knows which analyser produced it, under what conditions, or who approved it. Impossible to prove to an auditor.',
     'Un archivo de referencia circula entre hojas de cálculo y correos. Seis meses después, nadie sabe qué analizador lo produjo, en qué condiciones ni quién lo validó. Imposible demostrarlo a un auditor.'],
    ['Une machine peut se dérégler après un changement de réactif ou une usure. Si le contrôle qualité n’est relu qu’en fin de mois, des milliers de résultats sont rendus entre-temps, et les lots de référence de la période sont faussés.',
     'An analyser can drift after a reagent change or through wear. If quality control is only reviewed at the end of the month, thousands of results are issued in the meantime, and the period’s reference batches are distorted.',
     'Un analizador puede desajustarse tras un cambio de reactivo o por desgaste. Si el control de calidad solo se revisa a fin de mes, se entregan miles de resultados mientras tanto y los lotes de referencia del periodo quedan falseados.'],
    ['Dans un réseau, chaque site a ses machines. Un biais systématique (un appareil qui mesure toujours 6 % trop haut) est invisible localement : il n’apparaît qu’en comparant les sites entre eux.',
     'In a network, each site has its own analysers. A systematic bias (a device that always measures 6% too high) is invisible locally: it only shows up when sites are compared with each other.',
     'En una red, cada sitio tiene sus analizadores. Un sesgo sistemático (un aparato que siempre mide un 6 % de más) es invisible localmente: solo aparece al comparar los sitios entre sí.'],
    ['Chaque lot a une fiche : machine, conditions, fichier, pseudonymisation vérifiée, validation par un biologiste, historique et journal d’audit infalsifiable (empreintes SHA-256 chaînées), certificat avec QR code.',
     'Each batch has a record: analyser, conditions, file, verified pseudonymisation, biologist approval, history and a tamper-proof audit log (chained SHA-256 fingerprints), certificate with QR code.',
     'Cada lote tiene una ficha: analizador, condiciones, archivo, seudonimización verificada, validación por un biólogo, historial y registro de auditoría infalsificable (huellas SHA-256 encadenadas), certificado con código QR.'],
    ['Les règles de Westgard sont appliquées chaque jour aux contrôles qualité. Dès qu’une machine se dérègle, biologIA retrouve les lots de référence touchés et les passe en « à revalider ».',
     'Westgard rules are applied to quality controls every day. As soon as an analyser drifts, biologIA finds the affected reference batches and marks them “to re-approve”.',
     'Las reglas de Westgard se aplican cada día a los controles de calidad. En cuanto un analizador se desajusta, biologIA localiza los lotes de referencia afectados y los marca «por revalidar».'],
    ['Carte des sites, Sigma de chaque analyse, comparaison inter-laboratoires mensuelle, recommandations de contrôle adaptées : la direction qualité voit d’un coup d’œil où agir.',
     'Map of sites, Sigma for each test, monthly inter-laboratory comparison, tailored control recommendations: quality management sees at a glance where to act.',
     'Mapa de sitios, Sigma de cada análisis, comparación interlaboratorios mensual, recomendaciones de control adaptadas: la dirección de calidad ve de un vistazo dónde actuar.'],
    ['Chiffres calculés en direct sur les 20 laboratoires simulés en région Sud (janvier 2025 – novembre 2026), avec des volumes et des coûts d’analyses calés sur les vrais chiffres de l’Assurance Maladie et la population INSEE de chaque ville.',
     'Figures calculated live on the <a href="reseau.html">20 laboratories</a> simulated in southern France (January 2025 – November 2026), with test volumes and costs aligned with real French Health Insurance figures and each city’s INSEE population.',
     'Cifras calculadas en directo sobre los <a href="reseau.html">20 laboratorios</a> simulados en el sur de Francia (enero 2025 – noviembre 2026), con volúmenes y costes de análisis ajustados a las cifras reales del Seguro de Enfermedad francés y a la población INSEE de cada ciudad.'],
    ['Pourquoi ? Les vrais contrôles d’un laboratoire ne sont pas publics et les données de patients sont protégées (RGPD, secret médical).',
     '<b>Why?</b> A laboratory’s real controls are not public and patient data is protected (GDPR, medical confidentiality).',
     '<b>¿Por qué?</b> Los controles reales de un laboratorio no son públicos y los datos de pacientes están protegidos (RGPD, secreto médico).'],
    ['La simulation suit les lois statistiques réelles et donne toujours les mêmes chiffres (graine fixe) : on peut la vérifier.',
     'The simulation follows real statistical laws and <b>always gives the same figures</b> (fixed seed): it can be checked.',
     'La simulación sigue leyes estadísticas reales y da <b>siempre las mismas cifras</b> (semilla fija): se puede verificar.'],
    ['Le chiffre « résultats faux en moins » compare biologIA à une vérification une fois par mois. Beaucoup de laboratoires vérifient déjà chaque jour : pour eux, le gain est surtout le lien automatique entre une panne et les données à refaire.',
     'The “fewer wrong results” figure compares biologIA with checking <b>once a month</b>. Many laboratories already check every day: for them, the gain is mainly the <b>automatic link</b> between a fault and the data to redo.',
     'La cifra «menos resultados erróneos» compara biologIA con una verificación <b>una vez al mes</b>. Muchos laboratorios ya verifican cada día: para ellos, la ventaja es sobre todo el <b>vínculo automático</b> entre una avería y los datos que hay que rehacer.'],
    ['biologIA ne pose aucun diagnostic et ne remplace pas le biologiste : il prévient, l’humain décide (exigence de l’AI Act).',
     'biologIA <b>makes no diagnosis</b> and does not replace the biologist: it warns, the human decides (an AI Act requirement).',
     'biologIA <b>no emite ningún diagnóstico</b> ni sustituye al biólogo: avisa, y el humano decide (exigencia del AI Act).']
  ];

  // Paragraphes qui contiennent des chiffres calculés en direct
  const BLOCS_MODELES = [
    [/^Les (\d+) pannes restent actives jusqu’à la revue mensuelle : ([\d\s ]+) résultats patients rendus pendant qu’un appareil mesurait faux\.$/,
     'The $1 faults stay active until the monthly review: <b>$2</b> patient results issued while an analyser was measuring wrongly.',
     'Las $1 averías siguen activas hasta la revisión mensual: <b>$2</b> resultados de pacientes entregados mientras un aparato medía mal.'],
    [/^Pannes repérées en ([\d,]+) jour\(s\) en moyenne : ([\d\s ]+) résultats concernés, soit −(\d+) %\.$/,
     'Faults spotted in <b>$1 day(s)</b> on average: <b>$2</b> results affected, i.e. <b>−$3%</b>.',
     'Averías detectadas en <b>$1 día(s)</b> de media: <b>$2</b> resultados afectados, es decir <b>−$3 %</b>.'],
    [/^(\d+) lots de référence passés automatiquement « à revalider »\.$/,
     '<b>$1</b> reference batches automatically marked “to re-approve”.',
     '<b>$1</b> lotes de referencia marcados automáticamente «por revalidar».'],
    [/^(\d+) écarts inter-laboratoires détectés, dont des biais persistants expliqués\.$/,
     '<b>$1</b> inter-laboratory gaps detected, including explained persistent biases.',
     '<b>$1</b> desviaciones interlaboratorios detectadas, incluidos sesgos persistentes explicados.'],
    [/^([\d\s ]+) contrôles qualité analysés ; chaque seuil est relié à son lot, sa machine et son validateur\.$/,
     '$1 quality controls analysed; every threshold is linked to its batch, analyser and approver.',
     '$1 controles de calidad analizados; cada umbral está vinculado a su lote, su analizador y su validador.']
  ];

  // Textes qui contiennent un nombre : [modèle, anglais, espagnol]
  const MODELES = [
    [/^(\d+) lots?$/, '$1 batches', '$1 lotes'],
    [/^Page (\d+) \/ (\d+)$/, 'Page $1 / $2', 'Página $1 / $2'],
    [/^(\d+) patients?$/, '$1 patients', '$1 pacientes'],
    [/^(\d+) mesures?$/, '$1 measurements', '$1 mediciones'],
    [/^Note de confiance (\d+) \/ 100$/, 'Confidence score $1 / 100', 'Nota de confianza $1 / 100'],
    [/^(.+) — biologIA$/, null, null],
    [/^(\d+) machines? sur (\d+)\.$/, '$1 of $2 analysers.', '$1 de $2 analizadores.'],
    [/^(\d+) anomalies? détectées?$/, '$1 anomaly(ies) detected', '$1 anomalía(s) detectada(s)'],
    [/^(\d+) ouverte\(s\)$/, '$1 open', '$1 abierto(s)'],
    [/^Rôle demandé : (.+)$/, null, null],
    [/^pannes repérées, en ([\d,]+) jours en moyenne$/, 'faults spotted, in $1 days on average', 'averías detectadas, en $1 días de media'],
    [/^(\d+) sur (\d+) contrôles réussis\.$/, '$1 of $2 checks passed.', '$1 de $2 controles superados.'],
    [/^Dernière calibration : (.+)$/, 'Last calibration: $1', 'Última calibración: $1'],
    [/^en service depuis (\d{4})$/, 'in service since $1', 'en servicio desde $1'],
    [/^(\d+) lots? à revalider$/, '$1 batch(es) to re-approve', '$1 lote(s) por revalidar'],
    [/^(\d+) lots? en attente de validation$/, '$1 batch(es) awaiting approval', '$1 lote(s) pendiente(s) de validación'],
    [/^(\d+) pannes? réparées?$/, '$1 fault(s) repaired', '$1 avería(s) reparada(s)'],
    [/^dans (\d+) départements$/, 'in $1 departments', 'en $1 departamentos'],
    [/^([\d,]+ M) habitants$/, '$1 inhabitants', '$1 habitantes'],
    [/^(\d+) types d’analyses$/, '$1 types of tests', '$1 tipos de análisis'],
    [/^([\d,]+ M €) remboursés$/, '$1 reimbursed', '$1 reembolsados'],
    [/^(\d+) laboratoires, (\d+) machines, ([\d,]+ M) analyses de (\S+) (\d{4}) à (\S+) (\d{4})\.$/, '$1 laboratories, $2 analysers, $3 tests from $4 $5 to $6 $7.', '$1 laboratorios, $2 analizadores, $3 análisis de $4 $5 a $6 $7.']
  ];

  const index = { en: new Map(), es: new Map() };
  for (const [fr, en, es] of T) {
    index.en.set(fr, en);
    index.es.set(fr, es);
  }

  const indexBlocs = { en: new Map(), es: new Map() };
  for (const [fr, en, es] of BLOCS) {
    const cle = fr.replace(/\s+/g, ' ').trim();
    indexBlocs.en.set(cle, en);
    indexBlocs.es.set(cle, es);
  }
  function traduireBloc(texte, langue) {
    const brut = texte.replace(/\s+/g, ' ').trim();
    const d = indexBlocs[langue].get(brut);
    if (d != null) return d;
    for (const [re, en, es] of BLOCS_MODELES) {
      if (re.test(brut)) return brut.replace(re, langue === 'en' ? en : es);
    }
    return null;
  }

  function langueActuelle() {
    try { return localStorage.getItem('langueLabo') || 'fr'; } catch { return 'fr'; }
  }

  function traduireTexte(texte, langue, profond) {
    const brut = texte.replace(/\s+/g, ' ').trim();
    if (!brut) return null;
    const direct = index[langue].get(brut);
    if (direct != null) return direct;
    for (const [re, en, es] of MODELES) {
      const m = brut.match(re);
      if (!m) continue;
      if (en === null) {
        const t = index[langue].get(m[1]) || m[1];
        if (/^Rôle demandé/.test(brut)) return `${index[langue].get('Rôle demandé')} : ${t}`.replace(' : ', langue === 'en' ? ': ' : ': ');
        return index[langue].get(m[1]) ? `${t} — biologIA` : null;
      }
      return brut.replace(re, langue === 'en' ? en : es);
    }
    if (brut.includes(' · ') && !profond) {
      const morceaux = brut.split(' · ');
      const trads = morceaux.map((m) => traduireTexte(m, langue, true));
      if (trads.some((t) => t != null)) return trads.map((t, i) => t ?? morceaux[i]).join(' · ');
    }
    return null;
  }

  const ATTRIBUTS = ['placeholder', 'title', 'aria-label'];
  const DEJA = new WeakSet();

  function traduireArbre(racine, langue) {
    if (langue === 'fr' || !racine) return;
    const blocs = racine.querySelectorAll ? racine.querySelectorAll('p, li, td, small, span, div.en-clair') : [];
    for (const el of blocs) {
      if (el.dataset.traduit) continue;
      const trad = traduireBloc(el.textContent, langue);
      if (trad != null) { el.innerHTML = trad; el.dataset.traduit = '1'; }
    }
    const marcheur = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentElement;
        if (!p || /^(SCRIPT|STYLE|CODE|TEXTAREA)$/.test(p.tagName) || p.closest('[data-pas-traduire]')) return NodeFilter.FILTER_REJECT;
        return n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const noeuds = [];
    let n;
    while ((n = marcheur.nextNode())) noeuds.push(n);
    for (const t of noeuds) {
      if (DEJA.has(t)) continue;
      const trad = traduireTexte(t.textContent, langue);
      if (trad != null) {
        const debut = t.textContent.match(/^\s*/)[0];
        const fin = t.textContent.match(/\s*$/)[0];
        t.textContent = debut + trad + fin;
        DEJA.add(t);
      }
    }
    const elements = racine.querySelectorAll ? racine.querySelectorAll('[placeholder],[title],[aria-label]') : [];
    for (const el of elements) {
      for (const a of ATTRIBUTS) {
        const v = el.getAttribute(a);
        if (!v) continue;
        const trad = traduireTexte(v, langue);
        if (trad != null && trad !== v) el.setAttribute(a, trad);
      }
    }
  }

  function htmlSelecteur() {
    const actuelle = langueActuelle();
    return `<label class="langue-choix" data-pas-traduire title="Langue / Language / Idioma">
      <span class="sr-only">Langue</span>
      <select class="select-langue" aria-label="Langue / Language / Idioma">
        ${LANGUES.map((l) => `<option value="${l.code}"${l.code === actuelle ? ' selected' : ''}>${l.court} · ${l.nom}</option>`).join('')}
      </select></label>`;
  }

  function brancherSelecteurs(racine) {
    (racine || document).querySelectorAll('.select-langue').forEach((s) => {
      if (s.dataset.branche) return;
      s.dataset.branche = '1';
      s.addEventListener('change', () => {
        try { localStorage.setItem('langueLabo', s.value); } catch { /* ignore */ }
        location.reload();
      });
    });
  }

  function installerSelecteur() {
    // Page de connexion : emplacement prévu en haut à droite
    const slot = document.getElementById('langue-slot');
    if (slot && !slot.querySelector('.select-langue')) slot.innerHTML = htmlSelecteur();
    // Pages internes : dans la barre du haut, avant le bouton clair/sombre
    const bar = document.getElementById('topbar');
    if (bar && !bar.querySelector('.select-langue')) {
      const theme = document.getElementById('btn-theme');
      const div = document.createElement('div');
      div.innerHTML = htmlSelecteur();
      bar.insertBefore(div.firstElementChild, theme || null);
    }
    brancherSelecteurs();
  }

  function demarrer() {
    const langue = langueActuelle();
    document.documentElement.lang = langue;
    installerSelecteur();
    if (langue === 'fr') return;
    traduireArbre(document.body, langue);
    const titre = traduireTexte(document.title, langue);
    if (titre) document.title = titre;
    let attente = false;
    const obs = new MutationObserver(() => {
      if (attente) return;
      attente = true;
      requestAnimationFrame(() => {
        attente = false;
        installerSelecteur();
        traduireArbre(document.body, langue);
      });
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
  // la barre du haut est ajoutée un peu après le chargement
  window.addEventListener('session-prete', installerSelecteur);

  window.biologiaLangue = { langueActuelle, traduireTexte };
})();
