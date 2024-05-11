const cookieParser = require('cookie-parser');
const express = require('express');
const app = express();
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userModel = require('./models/user');
const postModel = require('./models/post');
const upload = require('./config/multerconfig'); 

app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());


app.get('/', function(req, res){
    res.render("index");
})

app.post('/register', async function(req, res){
    let { username, name, age, email, password } = req.body;

    let user = await userModel.findOne({ email });
    if(user) return res.status(500).send("User already exists");

    bcrypt.genSalt(12, function(err, salt){
        bcrypt.hash(password, salt, async function(err, hash){
            let user = await userModel.create({ username, name, age, email, password: hash });
            
            let token = jwt.sign({ email, userid: user._id }, "keysecret");
            res.cookie("token", token);
            res.send("Registered Successfully....");
        })
    })
})

app.get('/login', function(req, res){
    res.render("login");
})

app.post('/login', async function(req, res){
    let { email, password } = req.body;

    let user = await userModel.findOne({ email });
    if(!user) return res.status(500).send("Invalid Credential");

    bcrypt.compare(password, user.password, function(err, result){
        if(result) {
            let token = jwt.sign({ email, userid: user._id }, "keysecret");
            res.cookie("token", token);
            
            res.status(200).redirect("profile");
        }
        else res.redirect("login");       
    });
})

app.get('/logout', function(req, res){
    res.cookie("token", "");
    res.redirect("login")
})

app.get('/profile', isLoggedin, async function(req, res){
    // populate() : this function will need one argument and from that argument it will bring the data

    let user = await userModel.findOne({ email: req.user.email}).populate("posts");
    res.render("profile", { user });
})

app.post('/post', isLoggedin, async function(req, res){
    let user = await userModel.findOne({ email: req.user.email});
    let { content } = req.body;

    let post = await postModel.create({ user: user._id, content })
    user.posts.push(post._id);
    await user.save();

    res.redirect("profile");
})

app.get('/profile/upload', function(req, res){
    res.render("profileupload");
})

app.post('/upload',isLoggedin, upload.single("image"), async function(req, res){
    let user = await userModel.findOne({ email: req.user.email})
    user.profilepic = req.file.filename;
    await user.save();
    res.redirect("/profile")
})

app.get('/like/:id', isLoggedin, async function(req, res){
    // populate() : this function will need one argument and from that argument it will bring the data

    let post = await postModel.findOne({ _id: req.params.id}).populate("user");

    if(post.likes.indexOf(req.user.userid) === -1) {
        post.likes.push(req.user.userid);
    } else {
        post.likes.splice(post.likes.indexOf(req.user.userid), 1);
    }

    await post.save();
    res.redirect("/profile");
})

app.get('/edit/:id', isLoggedin, async function(req, res){
    // populate() : this function will need one argument and from that argument it will bring the data
    let post = await postModel.findOne({ _id: req.params.id}).populate("user");

    res.render("edit", { post });
})

app.post('/update/:id', isLoggedin, async function(req, res){
    // populate() : this function will need one argument and from that argument it will bring the data
    let post = await postModel.findOneAndUpdate({ _id: req.params.id}, { content: req.body.content });
    res.redirect("/profile");
})


function isLoggedin(req, res, next) {
    if(req.cookies.token ===  "") res.redirect("login");
    else {
        let data = jwt.verify(req.cookies.token, "keysecret");
        req.user = data;
    }
    next();
}

app.listen(3000, function(err){
    if(err) return res.status(500).send("Server not working");
    console.log("Server Running on Port 3000...");
});