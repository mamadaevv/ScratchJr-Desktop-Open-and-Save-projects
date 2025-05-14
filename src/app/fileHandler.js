import {remote} from 'electron';
import fs from 'fs';
import IO from './src/iPad/IO';
import ScratchJr from './src/editor/ScratchJr';
import ScratchAudio from './src/utils/ScratchAudio';
import Project from './src/editor/ui/Project';
import Home from './src/lobby/Home';
import iOS from './src/iPad/iOS';
import Camera from './src/painteditor/Camera';

export default class FileHandler {

    static openProjectFromFile () {
        remote.dialog.showOpenDialog(remote.getCurrentWindow(),{
            title: 'Открыть проект',
            buttonLabel: 'Открыть',
            filters: [
                { name: 'Проект ScratchJr', extensions: ['algo'] },
                { name: 'Все файлы', extensions: ['*'] }
            ],
            properties: ['openFile']
        }, (filePath) => {
            if (!filePath) {
                return;
            }
            this.prepareOpenedFile(filePath[0]);
        });
    }

    static prepareOpenedFile(filePath) {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                return;
            }
            var openedFile = JSON.parse(data)
            console.log(openedFile)
        
            var openedProject = openedFile.project;
            if (typeof openedProject.json === 'string') {
                openedProject.json = JSON.parse(openedProject.json);
            }
            if (typeof openedProject.thumbnail === 'string') {
                openedProject.thumbnail = JSON.parse(openedProject.thumbnail);
            }

            for (let i = 0; i < openedFile.projectfiles.length; i++) {
                var json = {};
                var keylist = ['MD5', 'CONTENTS'];
                var values = '?,?';
                json.values = [openedFile.projectfiles[i].MD5, openedFile.projectfiles[i].CONTENTS];
        
                json.stmt = 'insert into PROJECTFILES (' + keylist.toString() + ') values (' + values + ')';
                iOS.stmt(json);
            }
            console.log(openedProject)
            IO.createProject(openedProject, Home.gotoEditor);
            ScratchJr.saveProject();
        });
    }

    static saveProjectAs(e) {
        e.preventDefault();
        e.stopPropagation();
        if (ScratchJr.onHold) {
            return;
        }
        ScratchAudio.sndFX('tap.wav');
        ScratchJr.saveProject();

        remote.dialog.showSaveDialog(null,{
            title: 'Сохранить проект',
            defaultPath: 'project',
            buttonLabel: 'Сохранить',
            filters: [
                { name: 'Проект ScratchJr', extensions: ['algo'] }
            ]
        }, (filePath) => {
            if (!filePath) {
                return;
            }
            let data = Project.metadata;
            const projectData = typeof data.json == 'object' ? data.json : JSON.parse(data.json)
            console.log(projectData)
            console.log(data)
            let projectfiles = []
            data.json = JSON.parse(data.json);
            const md5List = [];

            function extractMD5(obj) {
                if (typeof obj !== 'object' || obj === null) return;
            
                if ('md5' in obj) {
                    md5List.push(obj.md5);
                }
            
                for (const key in obj) {
                    if (typeof obj[key] === 'object') {
                        extractMD5(obj[key]);
                    }
                }
            }
            
            extractMD5(projectData);
            console.log(md5List)

            for (var md5 of md5List) {
               getMD5Content(md5)
            }

            
            function getMD5Content(md5) {
                const json = {};
                json.stmt = `select * from PROJECTFILES where MD5='${md5}'`;
                
                function result (res) {
                    let resObj = JSON.parse(res)
                    console.log(resObj)
                    if (resObj.length > 0) {
                        projectfiles.push({MD5: resObj[0].MD5, CONTENTS: resObj[0].CONTENTS})
                    }
                }
            
                iOS.query(json, result);
            }

            /* for (var pageData in projectData) {
                console.log(projectData[pageData])
                console.log(projectData[pageData].md5)
                if (projectData[pageData].md5 == undefined) {
                    continue;
                }
                getMD5Content(projectData[pageData].md5)
                
                for (var pageValues in projectData[pageData]) {
                    console.log(projectData[pageData][pageValues])
                    console.log(projectData[pageData][pageValues].md5)
                    console.log(pageValues + ": " + JSON.stringify(projectData[pageData][pageValues]));
               
                    if (projectData[pageData][pageValues].md5 == undefined) {
                        continue;
                    }
                
                    getMD5Content(projectData[pageData][pageValues].md5);
                }
    
                function getMD5Content(md5) {
                    const json = {};
                    json.stmt = `select * from PROJECTFILES where MD5='${md5}'`;
                    
                    function result (res) {
                        let resObj = JSON.parse(res)
                        console.log(resObj)
                        if (resObj.length > 0) {
                            projectfiles.push({MD5: resObj[0].MD5, CONTENTS: resObj[0].CONTENTS})
                        }
                    }
                
                    iOS.query(json, result);
                }
    
            } */
            fs.writeFileSync(filePath, JSON.stringify({project:data, projectfiles:projectfiles}), 'utf-8');
        });
    }

    static openSprite(feedTarget) {
        Camera.startFeed(feedTarget, true);

        remote.dialog.showOpenDialog(remote.getCurrentWindow(),{
            title: 'Открыть изображение',
            buttonLabel: 'Открыть',
            filters: [
                { name: 'Изображение', extensions: ['png', 'jpg', 'jpeg'] }
            ],
            properties: ['openFile']
        }, (filePath) => {
            if (!filePath) {
                return;
            }
            
            const fs = require('fs');
            
            const data = fs.readFileSync(filePath[0]);

            const maxFileSize = 5 * 1024 * 1024; // Максимальный размер файла в байтах (5 МБ)

            if (data.length > maxFileSize) {
                alert('Изображение слишком большое, попробуй другое');
                return;
            }

            const blob = new Blob([data], { type: 'image/png' });

            var fileReader = new FileReader();
            fileReader.readAsDataURL(blob);
            fileReader.onloadend = function () {
                let base64string = fileReader.result;
                Camera.processimage(base64string.split(',')[1])
            }
        });
    }
}
