# MStudy

MStudy is a student-first school companion for planning, homework, timetables, notes, events, and connected school tools.

## Stack

- Next.js + React + TypeScript
- Firebase Authentication
- Firestore
- Google sign-in
- Google Classroom / Calendar / Drive integration planned as optional connections

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Create a Firebase web app and paste its public configuration values into `.env.local`.
3. Enable Google as a sign-in provider in Firebase Authentication.
4. Create a Firestore database.
5. Run `npm install` and then `npm run dev`.

The app is intentionally designed so students can use MStudy without connecting Google Classroom. Google school-tool integrations will be optional enhancements.
