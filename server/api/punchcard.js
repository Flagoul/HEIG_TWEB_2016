var router = require("express").Router();
var gApi = require("../utils/github-api");

var Commit = require("../db/db").Commit;


function saveCommit(commit, project) {
    var date = new Date(commit.commit.author.date);

    var newCommit = new Commit({
        _id: commit.sha,
        project: project,
        hour: date.getHours(),
        day: date.getDay(),
        files: commit.files.map(function (file) {
            return file.filename;
        })
    });

    newCommit.save();
    return newCommit;
}


function retrieveCommit(commit, request, project) {
    return Commit.findById(commit["sha"], "-__v -_id").then(function (object) {
        if (object === null) {
            return gApi(commit["url"], request.session, true).then(function(entry) {
                return saveCommit(entry, project);
            });
        } else {
            return object;
        }
    });
}


router.get("/projects", function(request, response) {
    gApi("user/repos?per_page=100", request.session)
        .then(function(data) {
            response.setHeader('Content-Type', 'application/json');
            response.send(JSON.stringify(data.map(function(project) {
                return project["full_name"];
            })));
        })
        .catch(function(err) {
            if (err.statusCode === 401) {
                // FIXME : this doesn't work
                request.session.redirect = "/#/punchcard";
                response.status(301).redirect("/auth/login");
            } else {
                console.log(err);
                response.status(500).send();
            }
        })
});


router.get("/commits/:user/:project", function(request, response) {
    var url = "repos/" + request.params.user + "/" + request.params.project + "/commits" +
        "?author=" + request.session.login + "&per_page=100";

    response.setHeader('Content-Type', 'application/json');
    gApi(url, request.session)
        .then(function (data) {
            // FIXME : would this be possible with ONE mongodb call ?
            return Promise.all(data.map(function (commit) {
                return retrieveCommit(commit, request, request.params.project);
            }))
        })
        .then(function(commits) {
            response.send(commits);
        })
        .catch(function (error) {
            if (error.statusCode === 409) {
                response.send(JSON.stringify([]));
            }
            else {
                console.log(error);
                response.status(500).send();
            }
        });
});


module.exports = router;
