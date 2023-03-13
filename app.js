const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");
const app = express();
app.use(express.json());
let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

//API1
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;

  const checkUser = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(checkUser);

  if (dbUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const createUserQuery = `
          INSERT INTO 
                user(username,password,name,gender)
          VALUES
                ('${username}','${hashedPassword}','${name}','${gender}');`;
      await db.run(createUserQuery);
      response.status(200);
      response.send("User created successfully");
    }
  }
});

//API2
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const checkUser = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUserExist = await db.get(checkUser);
  if (dbUserExist === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      dbUserExist.password
    );
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "yfujwdwkhhcn");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//Authenticate Token
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "yfujwdwkhhcn", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//API 3
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `select user_id from user where username = '${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  //console.log(getUserId);

  //get followers ids from user id
  const getFollowerIdsQuery = `select following_user_id from follower 
  where follower_user_id = ${getUserId.user_id};`;
  const getFollowerIds = await db.all(getFollowerIdsQuery);
  //console.log(getFollowerIds);
  //get follower ids array

  const getLoggedInUserId = getFollowerIds.map((eachUser) => {
    return eachUser.following_user_id;
  });

  //console.log(getLoggedInUserId);
  //console.log(`${getLoggedInUserId}`);

  const getTweetsQuery = `
        select
            user.username,tweet.tweet,tweet.date_time as dateTime
        FROM 
            user INNER JOIN tweet
            on user.user_id = tweet.user_id
        where user.user_id in (${getLoggedInUserId})
        order by 
            tweet.date_time DESC 
        limit 4
        ;`;
  const tweets = await db.all(getTweetsQuery);
  //console.log(tweets);
  response.send(tweets);
});

//API 4
app.get("/user/following/", authenticateToken, async (request, response) => {
  const { username } = request;

  const getUserIdQuery = `select user_id from user where username = '${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  //console.log(getUserId);  gives a db object as response

  const getFollowingUserIds = `select following_user_id from follower 
    where follower_user_id = ${getUserId.user_id} ;`;
  const followingUserIdsArray = await db.all(getFollowingUserIds);
  //console.log(followingUserIdsArray);

  const getFollowingUsers = followingUserIdsArray.map((eachUser) => {
    return eachUser.following_user_id;
  });
  //console.log(getFollowingUsers);

  const followingPeopleList = `select name from user 
  where user_id in (${getFollowingUsers});`;
  const followingNames = await db.all(followingPeopleList);
  response.send(followingNames);
});

//API 5
app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { username } = request;

  const getUserIdQuery = `select user_id from user where username = '${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  //console.log(getUserId);  gives a db object as response

  const getFollowerUserIds = `select follower_user_id from follower 
    where following_user_id = ${getUserId.user_id} ;`;
  const followerUserIdsArray = await db.all(getFollowerUserIds);
  //console.log(followerUserIdsArray);

  const getFollowerUsers = followerUserIdsArray.map((eachUser) => {
    return eachUser.follower_user_id;
  });
  //console.log(getFollowerUsers);

  const followerPeopleList = `select name from user 
  where user_id in (${getFollowerUsers});`;
  const followerNames = await db.all(followerPeopleList);
  response.send(followerNames);
});

//API 6
const api6Output = (likesCount, repliesCount, tweetData) => {
  return {
    tweet: tweetData.tweet,
    likes: likesCount.likes,
    replies: repliesCount.replies,
    dateTime: tweetData.date_time,
  };
};

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { username } = request;
  const { tweetId } = request.params;
  console.log(tweetId);

  const getUserIdQuery = `select user_id from user where username = '${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  console.log(getUserId); //gives a db object as response

  //get the ids of whom the user is following
  const getFollowingIdsQuery = `select following_user_id from follower 
    where follower_user_id = ${getUserId.user_id};`;
  const getFollowingIdsArray = await db.all(getFollowingIdsQuery);
  console.log(getFollowingIdsArray);

  //get ids from array through map function
  const getFollowingUserIds = getFollowingIdsArray.map((eachFollower) => {
    return eachFollower.following_user_id;
  });
  console.log(getFollowingUserIds);
  //get the tweets made by the users he is following
  const getTweetIdsQuery = `select tweet_id from tweet 
  where user_id in (${getFollowingUserIds});`;
  const getTweetIdsArray = await db.all(getTweetIdsQuery);
  console.log(getTweetIdsArray);

  const followingTweetIds = getTweetIdsArray.map((eachTweet) => {
    return eachTweet.tweet_id;
  });
  console.log(followingTweetIds);

  if (followingTweetIds.includes(parseInt(tweetId))) {
    //includes
    const likesCountQuery = `select count(user_id) as likes from like where tweet_id = ${tweetId};`;
    const likesCount = await db.get(likesCountQuery);

    const repliesCountQuery = `select count(user_id) as replies from reply where tweet_id = ${tweetId};`;
    const repliesCount = await db.get(repliesCountQuery);

    const tweetDataQuery = `select tweet,date_time from tweet where tweet_id = ${tweetId};`;
    const tweetData = await db.get(tweetDataQuery);

    response.send(api6Output(likesCount, repliesCount, tweetData));
  } else {
    response.status(401);
    response.send("Invalid Request");
    console.log("Invalid Request");
  }
});

//API 7

const convertLikedFollowerUserNameDbObjToResponseObj = (
  likedFollowerNamesDbObj
) => {
  return {
    likes: likedFollowerNamesDbObj,
  };
};

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;
    console.log(tweetId);

    const getUserIdQuery = `select user_id from user where username = '${username}';`;
    const getUserId = await db.get(getUserIdQuery);
    console.log(getUserId); //gives a db object as response

    const getFollowingIdsQuery = `select following_user_id from follower 
    where follower_user_id = ${getUserId.user_id};`;
    const getFollowingIdsArray = await db.all(getFollowingIdsQuery);
    console.log(getFollowingIdsArray);

    //get ids from array through map function
    const getFollowingUserIds = getFollowingIdsArray.map((eachFollower) => {
      return eachFollower.following_user_id;
    });
    console.log(getFollowingUserIds);
    //checking for the tweet made by his followers using tweet id
    const getTweetIdsQuery = `select tweet_id from tweet 
    where user_id in (${getFollowingUserIds});`;
    const getTweetIdsArray = await db.all(getTweetIdsQuery);
    console.log(getTweetIdsArray);

    const getFollowingTweetIds = getTweetIdsArray.map((eachTweet) => {
      return eachTweet.tweet_id;
    });
    console.log(getFollowingTweetIds);

    //get list of usernames who liked the tweet
    //console.log(getTweetIds.includes(parseInt(tweetId)));
    if (getFollowingTweetIds.includes(parseInt(tweetId))) {
      const getLikedFollowerNamesQuery = `select user.username as likes
        from user inner join like 
        on user.user_id = like.user_id where like.tweet_id = ${tweetId};`;
      const getLikedFollowerNamesArray = await db.all(
        getLikedFollowerNamesQuery
      );
      const getLikedFollowerNames = getLikedFollowerNamesArray.map(
        (eachFollower) => {
          return eachFollower.likes;
        }
      );
      console.log(getLikedFollowerNames);
      console.log(
        convertLikedFollowerUserNameDbObjToResponseObj(getLikedFollowerNames)
      );
      response.send(
        convertLikedFollowerUserNameDbObjToResponseObj(getLikedFollowerNames)
      );
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//API 8

const convertgetFollowingUserRepliesDbObjToResponseObj = (dbObj) => {
  return {
    replies: dbObj,
  };
};

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;
    console.log(tweetId);

    const getUserIdQuery = `select user_id from user where username = '${username}';`;
    const getUserId = await db.get(getUserIdQuery);
    console.log(getUserId); //gives a db object as response

    const getFollowingIdsQuery = `select following_user_id from follower 
    where follower_user_id = ${getUserId.user_id};`;
    const getFollowingIdsArray = await db.all(getFollowingIdsQuery);
    console.log(getFollowingIdsArray);

    //get ids from array through map function
    const getFollowingUserIds = getFollowingIdsArray.map((eachFollower) => {
      return eachFollower.following_user_id;
    });
    console.log(getFollowingUserIds);
    //checking for the tweet made by his followers using tweet id
    const getTweetIdsQuery = `select tweet_id from tweet 
    where user_id in (${getFollowingUserIds});`;
    const getTweetIdsArray = await db.all(getTweetIdsQuery);
    console.log(getTweetIdsArray);

    const getFollowingTweetIds = getTweetIdsArray.map((eachTweet) => {
      return eachTweet.tweet_id;
    });
    console.log(getFollowingTweetIds);

    //get list of usernames who liked the tweet
    //console.log(getTweetIds.includes(parseInt(tweetId)));
    if (getFollowingTweetIds.includes(parseInt(tweetId))) {
      const getFollowingUserRepliesQuery = `select user.name,reply.reply 
        from user inner join reply 
        on user.user_id = reply.user_id where reply.tweet_id = ${tweetId};`;
      const getFollowingUserRepliesArray = await db.all(
        getFollowingUserRepliesQuery
      );

      console.log(getFollowingUserRepliesArray);

      response.send(
        convertgetFollowingUserRepliesDbObjToResponseObj(
          getFollowingUserRepliesArray
        )
      );
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//API 9

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `select user_id from user where username = '${username}';`;
  const getUserId = await db.get(getUserIdQuery);

  const tweetsQuery = `
   select
   tweet,
   (select count(like_id)
    FROM like
    where tweet_id=tweet.tweet_id
   ) as likes,
   (select count(reply_id)
    from reply
    where tweet_id=tweet.tweet_id
   ) as replies,
   date_time as dateTime
   from tweet
   where user_id=${getUserId.user_id}
   ;`;
  const tweetData = await db.all(tweetsQuery);
  response.send(tweetData);
});

//API10

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;
  const { tweet } = request.body;

  const getUserIdQuery = `select user_id from user where username = '${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  console.log(getUserId); //gives a db object as response

  const currentDate = new Date();
  console.log(currentDate);
  console.log(currentDate.toISOString().replace("T", ""));

  const addTweetQuery = `insert into tweet (tweet,user_id,date_time) 
  values ('${tweet}',${getUserId.user_id},'${currentDate}')`;
  const addTweet = await db.run(addTweetQuery);
  console.log(addTweet);
  const tweetId = addTweet.lastID;
  console.log(tweetId);
  response.send("Created a Tweet");
});

//API 11

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    console.log(tweetId);
    let { username } = request;
    const getUserIdQuery = `select user_id from user where username='${username}';`;
    const getUserId = await db.get(getUserIdQuery);
    console.log(getUserId.user_id);
    //tweets made by the user
    const getUserTweetsListQuery = `select tweet_id from tweet where user_id=${getUserId.user_id};`;
    const getUserTweetsListArray = await db.all(getUserTweetsListQuery);
    const getUserTweetsList = getUserTweetsListArray.map((eachTweetId) => {
      return eachTweetId.tweet_id;
    });
    console.log(getUserTweetsList);
    if (getUserTweetsList.includes(parseInt(tweetId))) {
      const deleteTweetQuery = `delete from tweet where tweet_id=${tweetId};`;
      await db.run(deleteTweetQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

module.exports = app;
