const passport = require("passport");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
const User = require("../models/User");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value?.toLowerCase();
        const googleId = profile.id;

        if (!email) {
          return done(
            new Error("Google account did not return an email address."),
            null,
          );
        }

        // Scenario 1: Returning Google user
        const existingGoogleUser = await User.findOne({ googleId });
        if (existingGoogleUser) {
          return done(null, existingGoogleUser);
        }

        // Scenario 2: Email already registered via local auth — link accounts
        const existingLocalUser = await User.findOne({ email });
        if (existingLocalUser) {
          if (existingLocalUser.authProvider === "local") {
            existingLocalUser.googleId = googleId;
            existingLocalUser.authProvider = "google";
            existingLocalUser.isVerified = true;
            existingLocalUser.isProfileComplete = !!existingLocalUser.country;

            const defaultAvatar =
              "https://www.svgrepo.com/show/5125/avatar.svg";
            if (
              existingLocalUser.profileImage === defaultAvatar &&
              profile.photos?.[0]?.value
            ) {
              existingLocalUser.profileImage = profile.photos[0].value;
            }

            await existingLocalUser.save({ validateBeforeSave: false });
            return done(null, existingLocalUser);
          }
          return done(null, existingLocalUser);
        }

        // Scenario 3: Brand new user — country collected separately
        const newUser = await User.create({
          googleId,
          name: profile.displayName || email.split("@")[0],
          email,
          profileImage:
            profile.photos?.[0]?.value ||
            "https://www.svgrepo.com/show/5125/avatar.svg",
          authProvider: "google",
          isVerified: true,
          isProfileComplete: false,
        });

        return done(null, newUser);
      } catch (err) {
        return done(err, null);
      }
    },
  ),
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
