# WoF App

WoF App is a family fitness challenge app built with Expo, React Native, and
InstantDB. Family members can log in, complete quests, collect points, and see
shared Milanos goals such as weekly family steps, weekly family points, the
Milano Week Streak, and the Sunday Challenge ranking.

At the moment, health data is mocked so the app can still run in Expo Go. The
real Health Connect integration is prepared for a future custom Android build.

## Start The App

The app currently needs two terminals: one for the local username/password auth
server, and one for Expo.

Terminal 1:

```powershell
cd C:\Users\milan\Documents\WoF_App\wof_app
npm run auth-server
```

Terminal 2:

```powershell
cd C:\Users\milan\Documents\WoF_App\wof_app
npm run start -- --host lan
```

Use `--host lan` when testing on a smartphone, so the phone can reach the app
and the local auth server over the same Wi-Fi network.
