const express = require('express');
const router = express.Router();
const sharp = require('sharp');
const uploadFiles = require("../middleware/filesUpload");
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const textToImage = require('text-to-image');
const async = require('async');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Create Video from Images' });
});

/**POST submit files and text to generate video */
router.post('/upload', async function(req, res, next) {
  try {
    await uploadFiles(req, res); /**Upload all images in system using multer package */
    /**Get text for the form data */
    let filesCount = (req.files != null ) ? req.files.length : 0;
    let notes = (req.body.notes != null && req.body.notes != null) ? req.body.notes : [];
    /**Resize uploaded images in pre defined format */
    resizeImages(req.files,function(err,imageArr){
      if(err) throw err;
      /**Validate inouts */
      if (filesCount == 0 && notes.length == 0) {
        return res.send(`You must select at least 1 file or enter some text.`);
      }
      /**Generate images from text input */
      generateImgFromText(notes,(err,imageRespose) => {
        if(!err) {
          /**Generate video from the combination of uplaoded images and text images created by system */
            generateVideo([...imageArr,...imageRespose],(err,videoName) =>{
              console.log(err);
              if(!err)
              res.render('video', { title: 'Create Video from Images',video:videoName, message: 'Video has created success by merging uploaded images'});
              else
              res.render('video', { title: 'Create Video from Images',video:"",message: 'Error when generating video. Please try again' });
            });
        } else {
          /**Error handling */
          return res.send(`Error when creating sldier from text: ${err}`);
        }
      });
    });
  } catch (error) {
     /**Error handling */
    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return res.send("Too many files to upload.");
    }
    return res.send(`Error when trying upload many files: ${error}`);
  }
});

/**GET Download generated video */
router.get('/download', function(req, res, next) {
  try {
    const filePath = process.env.uploadPath; 
    res.download(filePath+req.query.name, req.query.name, (err) => {
      if (err) {
        res.status(500).send({
          message: "Could not download the file. " + err,
        });
      }
    });
  } catch (error) {
    return res.send(`Error when trying to download video: ${error}`);
  }  
});

/** Local function to generate image from text */
generateImgFromText = (notes,callback) => {
  let imageArr = [];
  async.forEachSeries(notes,(element,callbackInner) => {
      textToImage.generate(element, {
          debug: true,
          maxWidth: 1900,
          customHeight:1100,
          fontSize: 100,
          fontFamily: 'Arial',
          lineHeight: 120,
          margin: 50,
          textAlign:'center',
          bgColor: "#28bae9",
          textColor: "#FFF"
      }).then(function (dataUri,data) {
          let base64Data = dataUri.replace(/^data:image\/png;base64,/, "");
          let datetime = new Date().getTime();
          let imgPath = process.env.uploadPath+"text_"+datetime+".png";
          fs.writeFile(imgPath, base64Data, 'base64', (err) => {
            if(!err) {
              imageArr.push({
                path:imgPath,
                caption: '',
                loop: 5
              });
            }
            callbackInner(err);
          });
      });
  },(err) => {
    callback(err,imageArr);
 });
}

/** Local function to generate video from images */
generateVideo = (files,callback) => {
  let videoName = Date.now()+'-video.mp4';
  let videoshow = require('videoshow')
  videoshow(files)
  .save(process.env.uploadPath+videoName)
  .on('error', function (err) {
    unlinkImages(files);
    callback(err,videoName);})
  .on('end', function () {
    unlinkImages(files);
    callback(null,videoName);})
}

resizeImages = (files,callback) => {
  let imageArr = [];
  if(files.length == 0) {
    callback(null,imageArr);return true;
  }
  async.forEachSeries(files,(element,callbackInr) => {
    let filepath = element.path.replace('-img-','-resized-');
    sharp(element.path).resize(1900,1100)
    .jpeg({quality : 80}).toFile(filepath);
    imageArr.push({
      path:filepath,
      caption: '',
      loop: 3 // long caption
    });
    callbackInr(null);
  },function (err){
    callback(err,imageArr);
  });
}

/**Remove images from directory */
unlinkImages = (files) => {
  try{
    files.forEach(element => {
      setTimeout(function() {
       // fs.unlinkSync(element.path);
        fs.unlinkSync(element.path.replace('-resized-','-img-'));
      },3000); 
    })
  } catch(err){

  }
}

module.exports = router;
