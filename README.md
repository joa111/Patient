# Patient App

This is a NextJS application with Firebase integration.

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   - Copy `.env.local.example` to `.env.local`
   - Fill in your Firebase configuration values:
     ```
     NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
     NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-auth-domain"
     NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
     NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-storage-bucket"
     NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-messaging-sender-id"
     NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"
     ```

4. Run the development server:
   ```bash
   npm run dev
   ```

## Environment Variables

The application uses the following environment variables for Firebase configuration:

- `NEXT_PUBLIC_FIREBASE_API_KEY`: Your Firebase API Key
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`: Your Firebase Auth Domain
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`: Your Firebase Project ID
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`: Your Firebase Storage Bucket
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`: Your Firebase Messaging Sender ID
- `NEXT_PUBLIC_FIREBASE_APP_ID`: Your Firebase App ID

These variables should be set in a `.env.local` file in the root directory. This file should not be committed to version control.
