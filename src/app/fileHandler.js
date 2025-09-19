import {remote} from 'electron';
import fs from 'fs';
import IO from './src/iPad/IO';
import ScratchJr from './src/editor/ScratchJr';
import ScratchAudio from './src/utils/ScratchAudio';
import Project from './src/editor/ui/Project';
import Home from './src/lobby/Home';
import iOS from './src/iPad/iOS';
import Camera from './src/painteditor/Camera';
import Cookie from './src/utils/Cookie';

export default class FileHandler {

    static openProjectFromFile () {
        console.log('=== openProjectFromFile ВЫЗВАН ===');
        remote.dialog.showOpenDialog(remote.getCurrentWindow(),{
            title: 'Открыть проект',
            buttonLabel: 'Открыть',
            filters: [
                { name: 'Проект ScratchJr', extensions: ['algo', 'sjr'] },
                { name: 'Файлы algo', extensions: ['algo'] },
                { name: 'Файлы sjr', extensions: ['sjr'] },
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
        console.log('=== prepareOpenedFile вызван ===');
        console.log('Путь к файлу:', filePath);
        
        const extension = filePath.split('.').pop().toLowerCase();
        console.log('Расширение файла:', extension);
        
        if (extension === 'sjr') {
            console.log('=== Обрабатываем SJR файл ===');
            // Обработка sjr файлов (ZIP архивы)
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    console.error('Ошибка чтения sjr файла:', err);
                    return;
                }
                console.log('SJR файл прочитан, размер:', data.length, 'байт');
                
                // Конвертируем Buffer в base64 строку для loadProjectFromSjr
                const base64Data = data.toString('base64');
                console.log('Base64 данные готовы, длина:', base64Data.length);
                
                try {
                    console.log('Вызываем IO.loadProjectFromSjr...');
                    IO.loadProjectFromSjr(base64Data);
                } catch (error) {
                    console.error('Ошибка загрузки sjr проекта:', error);
                }
            });
        } else {
            // Обработка algo файлов (JSON)
            fs.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                    console.error('Ошибка чтения algo файла:', err);
                    return;
                }
                try {
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
                } catch (error) {
                    console.error('Ошибка обработки algo файла:', error);
                }
            });
        }
    }

    static saveProjectAs(e) {
        e.preventDefault();
        e.stopPropagation();
        if (ScratchJr.onHold) {
            return;
        }
        ScratchAudio.sndFX('tap.wav');
        ScratchJr.saveProject();

        // Получаем настройку формата проекта
        var projectExtension = Cookie.get('projectExtension') || window.Settings.defaultProjectExtension;
        
        // Если Cookie не установлен, устанавливаем значение по умолчанию
        if (!Cookie.get('projectExtension')) {
            Cookie.set('projectExtension', window.Settings.defaultProjectExtension);
            projectExtension = window.Settings.defaultProjectExtension;
        }
        
        console.log('Выбранный формат экспорта:', projectExtension);

        // Получаем имя текущего проекта
        var projectName = 'project';
        if (Project.metadata && Project.metadata.name) {
            projectName = Project.metadata.name.replace(/[<>:"/\\|?*]/g, '_'); // Убираем недопустимые символы для имени файла
        }
        console.log('Имя проекта:', projectName);

        // Настраиваем диалог сохранения в зависимости от формата
        var dialogOptions = {
            title: 'Сохранить проект',
            defaultPath: projectName,
            buttonLabel: 'Сохранить',
            filters: []
        };

        if (projectExtension === 'sjr') {
            dialogOptions.filters = [
                { name: 'Проект ScratchJr (SJR)', extensions: ['sjr'] },
                { name: 'Все файлы', extensions: ['*'] }
            ];
            dialogOptions.defaultPath = projectName + '.sjr';
        } else {
            dialogOptions.filters = [
                { name: 'Проект ScratchJr (ALGO)', extensions: ['algo'] },
                { name: 'Все файлы', extensions: ['*'] }
            ];
            dialogOptions.defaultPath = projectName + '.algo';
        }

        remote.dialog.showSaveDialog(null, dialogOptions, (filePath) => {
            if (!filePath) {
                return;
            }

            console.log('Сохраняем проект в:', filePath, 'формат:', projectExtension);

            if (projectExtension === 'sjr') {
                // Экспорт в SJR формат
                FileHandler.saveProjectAsSjr(filePath);
            } else {
                // Экспорт в ALGO формат (старая логика)
                FileHandler.saveProjectAsAlgo(filePath);
            }
        });
    }

    static saveProjectAsSjr(filePath) {
        console.log('=== Экспорт в SJR формат ===');
        
        IO.exportProjectToSjr(function(error, zipData) {
            if (error) {
                console.error('Ошибка экспорта в SJR:', error);
                return;
            }
            
            try {
                // Сохраняем данные архива на диск
                fs.writeFileSync(filePath, Buffer.from(zipData));
                console.log('SJR проект сохранен успешно:', filePath);
            } catch (writeError) {
                console.error('Ошибка сохранения SJR файла:', writeError);
            }
        });
    }

    static saveProjectAsAlgo(filePath) {
        console.log('=== Экспорт в ALGO формат ===');
        
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

        fs.writeFileSync(filePath, JSON.stringify({project:data, projectfiles:projectfiles}), 'utf-8');
        console.log('ALGO проект сохранен успешно:', filePath);
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
