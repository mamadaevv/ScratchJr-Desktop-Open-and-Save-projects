import {remote} from 'electron';
import fs from 'fs';
import IO from './src/iPad/IO';
import ScratchJr from './src/editor/ScratchJr';
import ScratchAudio from './src/utils/ScratchAudio';
import Project from './src/editor/ui/Project';
import Home from './src/lobby/Home';

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
            FileHandler.prepareOpenedFile(filePath[0]);
        });
    }

    static prepareOpenedFile(filePath) {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                return;
            }
            var openedProject = JSON.parse(data);
            if (typeof openedProject.json === 'string') {
                openedProject.json = JSON.parse(openedProject.json);
            }
            if (typeof openedProject.thumbnail === 'string') {
                openedProject.thumbnail = JSON.parse(openedProject.thumbnail);
            }

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

            fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
        });
    }
}
