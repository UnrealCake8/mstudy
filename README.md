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

MStudy uses the Google account already authenticated by Firebase and asks the user for additional read-only Classroom permission when they choose Connect Classroom.

Google Cloud setup:

1. Open the Google Cloud project that backs the MStudy Firebase project.
2. Enable the Google Classroom API.
3. Open Google Auth Platform / OAuth consent configuration.
4. Set the audience to External if students from multiple Google Workspace organizations should be able to connect.
5. Add the following scopes:
   - `https://www.googleapis.com/auth/classroom.courses.readonly`
   - `https://www.googleapis.com/auth/classroom.coursework.me.readonly`
   - `https://www.googleapis.com/auth/classroom.coursework.students.readonly`
6. Configure the app name, support email, developer contact details and any required authorized domains.
7. While the app is in Testing, add the Google accounts you want to test with as test users.
8. Before a broad public production launch, complete Google's OAuth verification for the sensitive Classroom scopes.

The `coursework.me.readonly` scope is used for student accounts. `coursework.students.readonly` lets teacher accounts read coursework too, which is useful for test accounts or future teacher-facing features. All Classroom access remains read-only.

No additional Vercel secret is required for this Classroom implementation. Classroom access tokens are used in memory to fetch data and are not stored in Firestore. MStudy stores only a cached copy of course and assignment metadata under the authenticated Firebase UID.

The current integration syncs when the user connects or presses Sync Classroom. Persistent background syncing can be added later with a server-side OAuth refresh-token flow if needed.

Some managed Google Workspace domains block unapproved third-party OAuth apps. In that case the user's Workspace administrator must allow/trust MStudy before Classroom can be connected.

## Data model

All private student data is scoped below `users/{firebaseUid}`. Firestore rules only allow the authenticated owner to access that tree, including cached Classroom data.

## Commands

- `npm run dev` — local development
- `npm run build` — production build
- `npm run check` — TypeScript check
