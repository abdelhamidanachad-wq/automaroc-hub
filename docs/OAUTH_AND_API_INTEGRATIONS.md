# MOROTTO — Connexion Google/Facebook et gestion des intégrations

## Activer la connexion Google et Facebook

Le code affiche maintenant des boutons Google et Facebook dans la fenêtre de connexion. Les fournisseurs doivent aussi être configurés dans Supabase; le code seul ne peut pas activer leurs identifiants.

1. Google Cloud Console: sélectionnez un projet, configurez l'écran de consentement OAuth, puis créez un identifiant OAuth de type application Web.
2. Supabase Dashboard → Authentication → Sign In / Providers → Google: activez Google et copiez le Client ID et le Client Secret.
3. Utilisez comme URI de redirection autorisée dans Google l'URL de callback exacte affichée par Supabase sur cette page fournisseur. N'utilisez pas seulement le domaine MOROTTO: Supabase est le callback OAuth.
4. Meta for Developers: créez/sélectionnez une application, ajoutez le produit Facebook Login, et configurez l'URI de redirection OAuth valide avec la même URL de callback fournie par Supabase.
5. Supabase Dashboard → Authentication → Sign In / Providers → Facebook: activez Facebook et renseignez l'App ID et l'App Secret.
6. Supabase Dashboard → Authentication → URL Configuration: définissez l'URL du site de production MOROTTO et ajoutez le domaine de production ainsi que les domaines preview Vercel nécessaires dans Redirect URLs.
7. Testez chaque fournisseur dans une fenêtre privée avec un nouveau compte. Les profils OAuth reçoivent désormais le nom à partir de display_name, full_name ou name si le fournisseur le fournit.

Les secrets OAuth Google/Facebook restent dans la configuration des fournisseurs Supabase. Ne les mettez jamais dans des variables VITE_ ni dans le gestionnaire de clés API ci-dessous.

## Gestionnaire des clés API

Le tableau d'administration propose des entrées pour Google Maps Platform, Apify, OpenAI, Anthropic et Google AI. Les clés sont chiffrées avec AES-256-GCM par une API Vercel côté serveur avant d'être enregistrées dans Supabase. Les tables ont RLS activé et refusent l'accès direct aux rôles anon/authenticated.

### Variables Vercel côté serveur

Ajoutez sous Project → Settings → Environment Variables:

- APP_ENCRYPTION_KEY: clé aléatoire de 32 octets en hexadécimal (64 caractères). Générez-la localement avec openssl rand -hex 32.
- SUPABASE_URL: URL du projet Supabase existant.
- SUPABASE_SERVICE_ROLE_KEY: clé secrète service-role Supabase. Jamais dans le navigateur.
- Gardez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY uniquement pour le client web.

Sauvegardez APP_ENCRYPTION_KEY dans un gestionnaire de secrets sécurisé. Si vous la perdez ou la remplacez sans rechiffrer les clés enregistrées, ces dernières ne pourront plus être déchiffrées.

### Base de données

Dans Supabase → SQL Editor, exécutez le fichier supabase/migrations/202610110006_integrations_vault.sql après les migrations précédentes. Le fichier 202610110007_oauth_profile_names.sql met à jour le déclencheur de profil pour les noms OAuth. Ces migrations n'ont pas été exécutées automatiquement sur votre projet.

### Usage et limites

Le panneau permet d'activer/désactiver les fournisseurs, de remplacer les clés, de supprimer une clé et de voir les appels enregistrés par MOROTTO sur les 30 derniers jours. Les tests de clés valident l'accès aux API Google Maps, Apify, OpenAI, Anthropic et Google AI.

Important: le budget mensuel est une valeur de suivi et n'est pas un plafond de facturation fournisseur. La limite quotidienne est actuellement une configuration d'administration, pas une protection complète contre tous les appels tant que chaque consommateur n'applique pas le contrôle côté serveur. Consultez les tableaux de bord de facturation des fournisseurs et configurez aussi leurs propres quotas, alertes et restrictions de clé.

Le scraping reste un usage distinct: activez-le seulement si MOROTTO a le droit de collecter et réutiliser les annonces et médias concernés. Les données importées doivent rester en attente de modération.
