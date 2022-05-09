const
    SplashWindow = require('./splashWindow.js'),
    { spawn } = require('child_process'),
    { app, BrowserWindow, ipcMain, shell, Menu, Tray, protocol, dialog, autoUpdater, remote, nativeImage, Notification } = require('electron'),
    path = require("path"),
    newAutoUpdater = require("electron-updater").autoUpdater,
    fs = require("fs"),
    xml = require('xml'),
    os = require('os'),
    crypto = require('crypto');

class Start {
    constructor(props = {}) {
        this.main = props.main;
        this.tempF = path.join(os.tmpdir(), 'servokio');
    }

    start(data) {
        console.log('Starting');

        console.log('Hi');
        console.log(`App version: ${data.app.getVersion()}`);
        console.log(`Platform: ${os.platform()}`);

        app.setAppUserModelId('net.servokio.app');

        if (!fs.existsSync(this.tempF)) fs.mkdirSync(this.tempF);

        //Display splash
        this.main.splashWindow = new SplashWindow();
        this.main.splashWindow.init(this.main.settings, data.app, () => this.main.mainWindow == null, () => {
            console.log('Splash initlfsidf koro4e done');
            this.check_status(data);
        });

        if (process.platform === 'win32') {
            const queryValue = ['HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', this.main.settings.appName];
            queryValue.unshift('query');
            const test_auto_start = spawn(this.main.settings.regExe, queryValue);
            let stdout = '';
            test_auto_start.stdout.on('data', (data) => {
                stdout += data;
            });
            test_auto_start.on('close', (code, signal) => {
                const doesOldKeyExist = stdout.indexOf(this.main.settings.appName) >= 0;
                this.main.local_settings.set('app_launch_with_the_system', doesOldKeyExist);
            });
        }

        data.app.whenReady().then(() => {
            //Трей
            let tray = new Tray(process.platform === 'win32' ? path.join(__dirname, '..', 'favicon-194x194.ico') : path.join(__dirname, '..', 'linux_256.png'));
            const contextMenu = Menu.buildFromTemplate([
                {
                    label: 'Show App',
                    click: () => {
                        if (this.main.mainWindow) this.main.mainWindow.show();
                    }
                },
                {
                    label: 'Settings',
                    submenu: [
                        {
                            label: 'Поверх всех окон',
                            sublabel: 'Приложение будет всегда впереди',
                            type: 'checkbox',
                            checked: this.main.local_settings.get('app_always_on_top'),
                            click: (e) => {
                                if (this.main.mainWindow) {
                                    this.main.mainWindow.webContents.send("fromMain", {
                                        type: 'change_setting',
                                        setting: 'app_always_on_top',
                                        value: e.checked
                                    });
                                    this.main.local_settings.set('app_always_on_top', e.checked);
                                    this.main.mainWindow.setAlwaysOnTop(e.checked);
                                }
                                console.log(e.checked)
                            }
                        },
                        {
                            label: 'Положение приложения',
                            sublabel: 'При запуске*',
                            submenu: [
                                {
                                    label: 'Стандарт',
                                    sublabel: 'По центру экрана, стандартный размер',
                                    click: () => {
                                        this.main.local_data.set('app_position', {
                                            type: 'default',
                                            bounds: this.main.local_data.get('app_position').bounds
                                        });
                                    }
                                },
                                {
                                    label: 'Текущая',
                                    sublabel: 'Запомнить текущую позицию и размеры',
                                    click: () => {
                                        this.main.local_data.set('app_position', {
                                            type: 'custom',
                                            bounds: this.main.mainWindow.getBounds()
                                        });
                                    }
                                }
                            ]
                        }
                    ]
                },
                {
                    type: 'separator'
                },
                {
                    label: 'WebSite',
                    click: () => {
                        shell.openExternal('https://servokio.ru')
                    }
                },
                {
                    label: 'Gratitudes',
                    click: () => {
                        shell.openExternal('https://servokio.ru/party')
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Проверить обновления',
                    click: () => {
                        if (this.main.useElectronUpdater) {
                            newAutoUpdater.checkForUpdates();
                        } else {
                            autoUpdater.checkForUpdates();
                        }
                    }
                },
                {
                    label: 'Close ' + require('./../package.json').version,
                    click: () => {
                        console.log('close')
                        if (this.main.splashWindow) this.main.splashWindow.end();
                        if (this.main.mainWindow) this.main.mainWindow.close();
                        if (this.main.autoupdater_interval !== null) clearInterval(this.main.autoupdater_interval);
                        if (this.main.modules.wallpaper !== null && this.main.modules.wallpaper.active) this.main.modules.wallpaper.end();
                    }
                }
            ]);
            tray.setToolTip('ServOKio');
            tray.setContextMenu(contextMenu);
            tray.on('click', () => {
                if (this.main.mainWindow) this.main.mainWindow.show();
            });

            console.log('Register protocol')
            protocol.interceptFileProtocol('file', (scheme, callback) => {
                const url = scheme.url.substr(8);
                if (url) {
                    callback({ url: path.normalize(`${__dirname}/${url}`) })
                } else console.error('Failed to register protocol');
            });
        });
    }

    check_status(data) {
        function isJson(str) { try { JSON.parse(str); } catch (e) { return false; } return true; }
        const getter = this.main.settings.servokio_stats_url.startsWith('https') ? require('https') : require('http');
        console.log(`Stats from ${this.main.settings.servokio_stats_url}`);
        getter.get(this.main.settings.servokio_stats_url, (res) => {
            const { statusCode } = res;
            if (statusCode !== 200) {
                console.error("Error getting update information");
                console.log(`A new attempt to get information will be made via: ${this.main.settings.retry_after_error}ms`);
                setTimeout(() => {
                    this.check_status(data);
                }, this.main.settings.retry_after_error);
            } else {
                res.setEncoding('utf8');
                let rawData = '';
                res.on('data', (chunk) => { rawData += chunk });
                res.on('end', () => {
                    if (isJson(rawData)) {
                        const stats = JSON.parse(rawData);
                        if (!this.main.develop.enable) {
                            if (this.main.useElectronUpdater) {
                                console.log('Use new updater');
                                this.setupAutoUpdaterEvents(data);
                            } else {
                                console.log('Use standart updater');
                                autoUpdater.setFeedURL(`https://${stats.domain}/updates` + '?v=' + app.getVersion());
                                this.setupAutoUpdaterEvents(data);
                            }
                        } else {
                            // const rpc = new DiscordRPC.Client({ transport: 'ipc' });
                            // const clientId = stats.discord_client_id;
                            // rpc.login({ clientId }).catch(console.error);
                            // const setActivity = async () => {
                            //     if (!rpc || !this.mainWindow) {
                            //         return;
                            //     }
                            //     this.mainWindow.webContents.executeJavaScript('window.boops');
                            //     rpc.setActivity(this.discord_presence);
                            // }
                            // rpc.on('ready', () => {
                            //     setActivity();

                            //     // activity can only be set every 15 seconds
                            //     setInterval(() => {
                            //         setActivity();
                            //     }, 15e3);
                            // });
                        }
                        this.startMain(data);
                    } else console.error("The server returned an invalid response.")
                });
            }
        }).on('error', (err) => {
            console.error("Error: " + err);
            console.log(`A new attempt to get information will be made via: ${this.main.settings.retry_after_error}ms`);
            setTimeout(() => {
                this.check_status(data);
            }, this.main.settings.retry_after_error);
        })
    }

    setupAutoUpdaterEvents(data) {
        //Check

        if (this.main.useElectronUpdater) {
            console.log(`Update channel: ${newAutoUpdater.channel}`);
        } else {
            console.log(`Update url: ${autoUpdater.getFeedURL()}`);
        }

        setTimeout(() => {
            if (this.main.useElectronUpdater) {
                newAutoUpdater.checkForUpdates();
            } else {
                autoUpdater.checkForUpdates();
            }
        }, 10 * 1000);

        this.main.autoupdater_interval = setInterval(() => {
            if (this.main.useElectronUpdater) {
                newAutoUpdater.checkForUpdates();
            } else {
                autoUpdater.checkForUpdates();
            }
        }, 10 * 1000 * 60);

        if (this.main.useElectronUpdater) {
            newAutoUpdater.on('error', (error) => {
                console.error(`Error on update: ${error.message}`);
                if (this.main.mainWindow !== null) this.main.mainWindow.webContents.send("fromMain", { type: 'update_updater_status_lol', status: 'error' });
                console.error(error);
            });

            newAutoUpdater.on('checking-for-update', () => {
                console.log(`Check for updates`);
                if (this.main.mainWindow !== null) this.main.mainWindow.webContents.send("fromMain", { type: 'update_updater_status_lol', status: 'checking' });
            });

            newAutoUpdater.on('update-available', () => {
                console.log(`An update is available`);
                if (this.main.mainWindow !== null) this.main.mainWindow.webContents.send("fromMain", { type: 'update_updater_status_lol', status: 'available' });
            });

            newAutoUpdater.on('update-not-available', () => {
                console.log(`No updates found`);
                if (this.main.mainWindow !== null) this.main.mainWindow.webContents.send("fromMain", { type: 'update_updater_status_lol', status: 'not_available' });
            });

            newAutoUpdater.on('update-downloaded', (event, releaseNotes, releaseName, releaseDate, updateURL) => {
                console.log(`New update: ${releaseDate}`);
                if (this.main.mainWindow !== null) this.main.mainWindow.webContents.send("fromMain", { type: 'update_updater_status_lol', status: 'downloaded' });
                const n = new Notification({
                    title: 'Update is ready',
                    body: 'Just click "update"',
                    silent: true,
                    icon: path.join(__dirname, '..', '256x256.ico'),
                    closeButtonText: 'close',
                });
                n.on('click', _ => {
                    if (this.main.useElectronUpdater) newAutoUpdater.quitAndInstall();
                })
                n.show();
            });

            newAutoUpdater.on('before-quit-for-update', () => {
                console.log(`bgau`);
            });
        } else {
            autoUpdater.on('error', (error) => {
                console.error(`Error on update: ${error.message}`);
                if (this.main.mainWindow !== null) this.main.mainWindow.webContents.send("fromMain", { type: 'update_updater_status_lol', status: 'error' });
                console.error(error);
            });

            autoUpdater.on('checking-for-update', () => {
                console.log(`Check for updates`);
                if (this.main.mainWindow !== null) this.main.mainWindow.webContents.send("fromMain", { type: 'update_updater_status_lol', status: 'checking' });
            });

            autoUpdater.on('update-available', () => {
                console.log(`An update is available`);
                if (this.main.mainWindow !== null) this.main.mainWindow.webContents.send("fromMain", { type: 'update_updater_status_lol', status: 'available' });
            });

            autoUpdater.on('update-not-available', () => {
                console.log(`No updates found`);
                if (this.main.mainWindow !== null) this.main.mainWindow.webContents.send("fromMain", { type: 'update_updater_status_lol', status: 'not_available' });
            });

            autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName, releaseDate, updateURL) => {
                console.log(`New update: ${releaseDate}`);
                if (this.main.mainWindow !== null) this.main.mainWindow.webContents.send("fromMain", { type: 'update_updater_status_lol', status: 'downloaded' });
            });

            autoUpdater.on('before-quit-for-update', () => {
                console.log(`bgau`);
            });
        }
    }

    startMain() {
        console.log("Start main");
        this.main.modules.wallpaper.init();
        this.main.modules.music.updateSounds();

        if (this.main.mainWindow === null) {
            console.log("Start main null - ok");
            this.main.mainWindow = new BrowserWindow(this.main.settings.main_screen_settings);

            this.main.mainWindow.webContents.once('new-window', (e, windowURL) => {
                console.log(windowURL)
                e.preventDefault();
                shell.openExternal(windowURL);
            });

            this.main.mainWindow.webContents.once('dom-ready', () => {
                console.log('main loaded');
                if (this.main.splashWindow) setTimeout(() => this.main.splashWindow.nukeWindow(), 100);

                this.main.mainWindow.show();
                this.main.mainWindow.setAlwaysOnTop(this.main.local_settings.get('app_always_on_top'));
                if (this.main.local_data.get('app_position').type === 'custom') this.main.mainWindow.setBounds(this.main.local_data.get('app_position').bounds);
                if (this.main.develop.enable) this.main.mainWindow.webContents.openDevTools();
            });

            const isMac = process.platform === 'darwin'

            Menu.setApplicationMenu(Menu.buildFromTemplate([
                // { role: 'appMenu' }
                ...(isMac ? [{
                    label: app.name,
                    submenu: [
                        { role: 'about' },
                        { type: 'separator' },
                        { role: 'services' },
                        { type: 'separator' },
                        { role: 'hide' },
                        { role: 'hideothers' },
                        { role: 'unhide' },
                        { type: 'separator' },
                        { role: 'quit' }
                    ]
                }] : []),
                // { role: 'fileMenu' }
                {
                    label: 'File',
                    submenu: [
                        isMac ? { role: 'close' } : { role: 'quit' }
                    ]
                },
                // { role: 'editMenu' }
                {
                    label: 'Edit',
                    submenu: [
                        { role: 'undo' },
                        { role: 'redo' },
                        { type: 'separator' },
                        { role: 'cut' },
                        { role: 'copy' },
                        { role: 'paste' },
                        ...(isMac ? [
                            { role: 'pasteAndMatchStyle' },
                            { role: 'delete' },
                            { role: 'selectAll' },
                            { type: 'separator' },
                            {
                                label: 'Speech',
                                submenu: [
                                    { role: 'startSpeaking' },
                                    { role: 'stopSpeaking' }
                                ]
                            }
                        ] : [
                            { role: 'delete' },
                            { type: 'separator' },
                            { role: 'selectAll' }
                        ])
                    ]
                },
                // { role: 'viewMenu' }
                {
                    label: 'View',
                    submenu: [
                        { role: 'reload' },
                        { role: 'forceReload' },
                        { role: 'toggleDevTools' },
                        { type: 'separator' },
                        { role: 'resetZoom' },
                        { role: 'zoomIn' },
                        { role: 'zoomOut' },
                        { type: 'separator' },
                        { role: 'togglefullscreen' }
                    ]
                },
                // { role: 'windowMenu' }
                {
                    label: 'Window',
                    submenu: [
                        { role: 'minimize' },
                        { role: 'zoom' },
                        ...(isMac ? [
                            { type: 'separator' },
                            { role: 'front' },
                            { type: 'separator' },
                            { role: 'window' }
                        ] : [
                            { role: 'close' }
                        ])
                    ]
                },
                {
                    role: 'help',
                    submenu: [
                        {
                            label: 'Learn More',
                            click: async () => {
                                const { shell } = require('electron')
                                await shell.openExternal('https://electronjs.org')
                            }
                        }
                    ]
                },
                {
                    label: 'Settings',
                    submenu: [
                        {
                            label: 'Поверх всех окон',
                            sublabel: 'Приложение будет всегда впереди',
                            type: 'checkbox',
                            checked: this.main.local_settings.get('app_always_on_top'),
                            click: (e) => {
                                if (this.main.mainWindow) {
                                    this.main.mainWindow.webContents.send("fromMain", {
                                        type: 'change_setting',
                                        setting: 'app_always_on_top',
                                        value: e.checked
                                    });
                                    this.main.local_settings.set('app_always_on_top', e.checked);
                                    this.main.mainWindow.setAlwaysOnTop(e.checked);
                                }
                                console.log(e.checked)
                            }
                        },
                        {
                            label: 'Положение приложения',
                            sublabel: 'При запуске*',
                            submenu: [
                                {
                                    label: 'Стандарт',
                                    sublabel: 'По центру экрана, стандартный размер',
                                    click: () => {
                                        this.main.local_data.set('app_position', {
                                            type: 'default',
                                            bounds: this.main.local_data.get('app_position').bounds
                                        });
                                    }
                                },
                                {
                                    label: 'Текущая',
                                    sublabel: 'Запомнить текущую позицию и размеры',
                                    click: () => {
                                        this.main.local_data.set('app_position', {
                                            type: 'custom',
                                            bounds: this.main.mainWindow.getBounds()
                                        });
                                    }
                                }
                            ]
                        }
                    ]
                },
            ]));

            this.main.mainWindow.loadURL(this.main.develop.enable ? 'http://localhost:3000/app/music/life' : 'https://servokio.ru/app');

            let images = [];
            function updateImages() {
                function readPath(path_location) {
                    //console.log(path_location)
                    setTimeout(() => {
                        fs.readdir(path_location, (err, files) => {
                            if (err) {
                                console.log(err);
                            } else {
                                for (let i = 0; i < files.length; i++) {
                                    fs.stat(`${path_location}\\${files[i]}`, function (err, stats) {
                                        if (err) {
                                            console.log(err);
                                        } else {
                                            //console.log(`${files[i]}`);
                                            if (stats.isDirectory()) {
                                                readPath(`${path_location}\\${files[i]}`);
                                            } else if (['jpg', 'png', 'gif', 'jpeg', 'webp'].includes(files[i].split(".").pop())) {
                                                //console.log(`+ ${files[i]}`);
                                                //console.log(`${path_location}\\${files[i]}`)
                                                images.push(`${path_location}\\${files[i]}`)
                                            }
                                        }
                                    });
                                }
                            }
                        });
                    }, 0);
                }

                //readPath("F:\\PC2\\images\\p\\tigers");
            }
            updateImages();
            let MainIsMaximized = false;

            function getRandomInt(min, max) {
                min = Math.ceil(min);
                max = Math.floor(max);
                return Math.floor(Math.random() * (max - min)) + min;
            }

            ipcMain.on("toMain", (event, sData) => {
                console.log(`+ ${sData.type}`);
                const startTimestamp = new Date();
                switch (sData.type) {
                    case "get_local_sounds":
                        event.returnValue = this.main.modules.music.getSounds();
                        break;
                    case "get_local_images":
                        event.returnValue = images;
                        break;
                    case "close_app":
                        if (this.main.mainWindow) this.main.mainWindow.hide();
                        break;
                    case "music.update.listenings":
                        const listenings = this.main.modules.music.music_data.get('tracks');
                        if (!listenings[sData.id]) listenings[sData.id] = { listenings: 0 }
                        listenings[sData.id].listenings++;
                        this.main.modules.music.music_data.set('tracks', listenings);
                        break;
                    case "music.update.seekedListenings":
                        const seekedListenings = this.main.modules.music.music_data.get('tracks');
                        if (!seekedListenings[sData.id]) seekedListenings[sData.id] = { seeked_listenings: 0 }
                        seekedListenings[sData.id].seeked_listenings++;
                        this.main.modules.music.music_data.set('tracks', seekedListenings);
                        break;
                    case "music.update.customTitle":
                        const tracks = this.main.music_data.get('tracks');
                        if (!tracks[sData.id]) tracks[sData.id] = { customTitle: '-' }
                        tracks[sData.id].customTitle = sData.title;
                        this.main.modules.music.music_data.set('tracks', tracks);
                        break;
                    case "maximize_app":
                        if (this.main.mainWindow) {
                            if (MainIsMaximized) {
                                //Тут проблема, похоже когда нет рамки он не видит минимум
                                this.main.mainWindow.unmaximize();
                                MainIsMaximized = false;
                            } else {
                                this.main.mainWindow.maximize();
                                MainIsMaximized = true;
                            }
                        }
                        break;
                    case "roll_up_app":
                        if (this.main.mainWindow) this.main.mainWindow.minimize();
                        break;
                    case "change_setting":
                        if (sData.setting === 'app_always_on_top') {
                            this.main.local_settings.set('app_always_on_top', sData.value);
                            this.main.mainWindow.setAlwaysOnTop(sData.value);
                        } else if (sData.setting === 'app_launch_with_the_system') {
                            if (process.platform === 'win32') {
                                const queryValue = ['HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', this.main.settings.appName];
                                queryValue.unshift('query');
                                const ls = spawn(this.main.settings.regExe, queryValue);
                                let stdout = '';
                                ls.stdout.on('data', (data) => {
                                    stdout += data;
                                });
                                ls.on('close', (code, signal) => {
                                    const doesOldKeyExist = stdout.indexOf(this.main.settings.appName) >= 0;
                                    if (sData.value) { //Установить
                                        if (!doesOldKeyExist) {
                                            const args = ['HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', this.main.settings.appName, '/d', process.execPath]
                                            args.unshift('add');
                                            args.push('/f');
                                            const ls = spawn(this.main.settings.regExe, args);
                                            this.main.local_settings.set('app_launch_with_the_system', true);
                                        }
                                    } else { //Удалить
                                        if (doesOldKeyExist) {
                                            const queryValue = ['HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', this.main.settings.appName, '/f'];
                                            queryValue.unshift('delete');
                                            const ls = spawn(this.main.settings.regExe, queryValue);
                                            this.main.local_settings.set('app_launch_with_the_system', false);
                                        }
                                    }
                                });
                            }
                        } else {
                            console.log(`Change other: ${sData.setting} -> ${sData.value}`)
                            this.main.local_settings.set(sData.setting, sData.value);
                        }
                        break;
                    case "get_local_settings":
                        event.returnValue = {
                            settings: this.main.local_settings.getData(),
                            data: this.main.local_data.getData()
                        }
                        break;
                    case "select_music_folder":
                        if (this.main.mainWindow) dialog.showOpenDialog(this.main.mainWindow, {
                            title: "Выберите папку с музыкой",
                            buttonLabel: "Да, именно она",
                            properties: ['openDirectory']
                        }).then(result => {
                            if (!result.canceled) {
                                //0:03 ночи, поэтому мне лень делать всё нормально
                                //в будущем:
                                //6:28 - соси жопу
                                let
                                    folders = this.main.local_data.get('music_search_in_folders'),
                                    newF = [];
                                result.filePaths.forEach(folter => {
                                    if (!folders.includes(folter)) {
                                        folders.push(folter);
                                        newF.push(folter);
                                    }
                                });
                                this.main.local_data.set('music_search_in_folders', folders);
                                this.main.mainWindow.webContents.send("fromMain", {
                                    type: 'change_data',
                                    param: 'music_search_in_folders',
                                    value: folders
                                });
                                newF.forEach(f => this.main.modules.music.updateSounds(f));
                            }
                        }).catch(err => {
                            console.log(err)
                        });
                        break;
                    case "delete_music_folder":
                        let folders = this.main.local_data.get('music_search_in_folders').filter(f => f !== sData.folter);
                        this.main.local_data.set('music_search_in_folders', folders);
                        this.main.mainWindow.webContents.send("fromMain", {
                            type: 'change_data',
                            param: 'music_search_in_folders',
                            value: folders
                        });
                        this.main.modules.music.removeFolter(folter);
                        break;
                    case "new_music_presence":
                        this.main.discord_presence = {
                            details: sData.title + ' - ' + sData.description,
                            state: `Listening to music`,
                            startTimestamp: startTimestamp,
                            largeImageKey: '0001',
                            instance: false,
                        }
                        if (this.main.mainWindow != null) {
                            if (sData.picture) {
                                const icon = sData.picture.startsWith('http') ? nativeImage.createFromDataURL(sData.picture) : nativeImage.createFromDataURL(sData.picture);
                                this.main.mainWindow.setOverlayIcon(icon, sData.title + ' - ' + sData.description);
                            }
                        }
                        break;
                    case "update_app":
                        if (this.main.useElectronUpdater) {
                            newAutoUpdater.quitAndInstall();
                        } else autoUpdater.quitAndInstall();
                    case "select_dynamic_wallpaper":
                        if (this.main.mainWindow && ['original', 'hidden'].includes(sData.obj)) dialog.showOpenDialog(this.main.mainWindow, {
                            title: "Выберите обои",
                            filters: [
                                { name: 'Images', extensions: ['jpg', 'png', 'jpeg'] }
                            ],
                            buttonLabel: "Выбрать",
                            properties: ['openFile']
                        }).then(result => {
                            if (!result.canceled) {
                                const userDataPath = (app || remote.app).getPath('userData');
                                const path_to_save = path.join(userDataPath, `${sData.obj}${getRandomInt(0, 1000)}.${result.filePaths[0].split('.').pop()}`);
                                fs.copyFile(result.filePaths[0], path_to_save, (err) => {
                                    if (err) throw err;
                                    console.log(`Check ${userDataPath}`);
                                    let old = this.main.local_data.get('app_device_dynamic_wallpaper');
                                    if (fs.existsSync(old[sData.obj])) fs.unlinkSync(old[sData.obj]);
                                    old[sData.obj] = path_to_save;
                                    this.main.local_data.set('app_device_dynamic_wallpaper', old);
                                    this.main.mainWindow.webContents.send("fromMain", {
                                        type: 'change_data',
                                        param: 'app_device_dynamic_wallpaper',
                                        value: old
                                    });
                                    this.main.modules.wallpaper.updateData(old);
                                    this.main.modules.wallpaper.checkWallpaper();
                                });
                            }
                        }).catch(err => {
                            console.log(err)
                        });
                        break;
                    case "update_data":
                        this.main.local_data.set(sData.param, sData.value);
                        this.main.mainWindow.webContents.send("fromMain", {
                            type: 'change_data',
                            param: sData.param,
                            value: sData.value
                        });
                        break;
                    case 'send_notification':
                        {
                            let pre = {};
                            if (sData.title) pre.title = sData.title;
                            if (sData.description) pre.body = sData.description;
                            if (sData.attribution) pre.attribution = sData.attribution;
                            pre.silent = sData.silent ? true : false;
                            if (sData.icon) pre.icon = {
                                img: sData.icon.startsWith('http') || sData.icon.startsWith('data') ? nativeImage.createFromDataURL(sData.icon) : sData.icon
                            }
                            if (sData.image) pre.image = {
                                img: sData.icon.startsWith('http') || sData.image.startsWith('data') ? nativeImage.createFromDataURL(sData.image) : sData.image,
                            }

                            let notificationObj = {
                                toast: [
                                    { _attr: { launch: 'app-defined-string' } },
                                    { audio: [{ _attr: { silent: pre.silent } }] },
                                    {
                                        visual: [{
                                            binding: [
                                                { _attr: { template: 'ToastGeneric' } },
                                                { text: [{ _attr: { id: '1' } }, pre.title] },
                                                { text: [{ _attr: { id: '2' } }, pre.body] },
                                                { text: [{ _attr: { placement: 'attribution' } }, pre.attribution] }
                                            ]
                                        }]
                                    }
                                ]
                            };

                            if (pre.icon) {
                                const filename = crypto.createHash('md5').update(sData.icon).digest('hex') + '.png';
                                pre.icon.fileName = filename;
                            }

                            if (pre.image){
                                const filename = crypto.createHash('md5').update(sData.image).digest('hex') + '.png';
                                pre.image.fileName = filename;
                            }

                            if(pre.icon || pre.image){
                                let
                                    c = 0,
                                    f = 0;

                                if(pre.icon){
                                    f++;
                                    fs.stat(path.join(this.tempF, pre.icon.fileName), (err, stat) => {
                                        const p = _ => notificationObj.toast[2].visual[0].binding.push({ image: [{ _attr: { id: '1', placement: 'appLogoOverride', 'hint-crop': 'circle', src: path.join(this.tempF, pre.icon.fileName) } }] });
                                        if (err == null) {
                                            c++;
                                            p();
                                            ch();
                                        } else if (err.code === 'ENOENT') {
                                            fs.writeFile(path.join(this.tempF, pre.icon.fileName), pre.icon.img.toPNG(), err => {
                                                if (err){
                                                    console.error(err);
                                                } else p();
                                                c++;
                                                ch();
                                            });
                                        } else console.error(err);
                                    });
                                }
                                if(pre.image){
                                    f++;
                                    fs.stat(path.join(this.tempF, pre.image.fileName), (err, stat) => {
                                        const p = _ => notificationObj.toast[2].visual[0].binding.push({ image: [{ _attr: { src: path.join(this.tempF, pre.image.fileName) } }] });
                                        if (err == null) {
                                            c++;
                                            p();
                                            ch();
                                        } else if (err.code === 'ENOENT') {
                                            fs.writeFile(path.join(this.tempF, pre.image.fileName), pre.image.img.toPNG(), err => {
                                                if (err){
                                                    console.error(err);
                                                } else p();
                                                c++;
                                                ch();
                                            });
                                        } else console.error(err);
                                    });
                                }
                                function ch(){ if(c >= f) send();}
                            } else send();

                            function send(){
                                const n = new Notification({ toastXml: xml(notificationObj, true) });
                                n.show();
                            }
                        }
                        break;
                    default:
                        console.log('Шо такое ? Кто это ? Отвали со своим этим самым');
                }
            });

            if (process.platform === 'win32') this.main.mainWindow.on('session-end', () => this.main.modules.wallpaper.end());
            //this.initMinecraft()
            //mainWindow.maximize();
        }
    }
}

module.exports = Start;