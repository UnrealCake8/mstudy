# MStudy

MStudy is a student-first school companion for homework, timetables, notes, school events and connected school tools.

## Production setup

1. Create a Firebase Web App.
2. Enable Google in Firebase Authentication.
3. Create Firestore in production mode.
4. Copy the values from `.env.example` into Vercel Environment Variables.
5. In Firebase Authentication > Settings > Authorized domains, add your Vercel/custom production domain.
6. Install Firebase CLI and deploy the included rules with `firebase deploy --only firestore:rules`.
7. Deploy the repository on Vercel.

## Google Classroom

MStudy uses the Google account already authenticated by Firebase and asks the student for additional read-only Classroom permission when they choose Connect Classroom.

Google Cloud setup:

1. Open the Google Cloud project that backs the MStudy Firebase project.
2. Enable the Google Classroom API.
3. Open Google Auth Platform / OAuth consent configuration.
4. Add the following scopes:
   - `https://www.googleapis.com/auth/classroom.courses.readonly`
   - `https://www.googleapis.com/auth/classroom.coursework.me.readonly`
5. Configure the app audience/consent screen as required by Google.
6. If the OAuth app is in testing mode, add the Google accounts you want to test with as test users.

No additional Vercel secret is required for this Classroom implementation. Classroom access tokens are used in memory to fetch data and are not stored in Firestore. MStudy stores only a cached copy of the student's course and assignment metadata under their Firebase UID.

Some managed Google Workspace domains block unapproved third-party OAuth apps. In that case the student's Workspace administrator must allow/trust MStudy before Classroom can be connected.

## Data model

All private student data is scoped below `users/{firebaseUid}`. Firestore rules only allow the authenticated owner to access that tree, including cached Classroom data.

## Commands

- `npm run dev` — local development
- `npm run build` — production build
- `npm run check` — TypeScript check
