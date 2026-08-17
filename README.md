# MStudy

MStudy is a student-first school companion for homework, timetables, notes and school events.

## Production setup

1. Create a Firebase Web App.
2. Enable Google in Firebase Authentication.
3. Create Firestore in production mode.
4. Copy the values from `.env.example` into Vercel Environment Variables.
5. In Firebase Authentication > Settings > Authorized domains, add your Vercel/custom production domain.
6. Install Firebase CLI and deploy the included rules with `firebase deploy --only firestore:rules`.
7. Deploy the repository on Vercel.

## Data model

All private student data is scoped below `users/{firebaseUid}`. Firestore rules only allow the authenticated owner to access that tree.

## Commands

- `npm run dev` — local development
- `npm run build` — production build
- `npm run check` — TypeScript check
