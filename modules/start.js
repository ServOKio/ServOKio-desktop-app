const
    SplashWindow = require('./splashWindow.js'),
    { spawn } = require('child_process'),
    { app, BrowserWindow, ipcMain, shell, Menu, Tray, protocol, dialog, autoUpdater, remote, nativeImage } = require('electron'),
    path = require("path"),
    newAutoUpdater = require("electron-updater").autoUpdater,
    fs = require("fs");

class Start {
    constructor(options = {}) {
    }

    start(data) {
        console.log('Starting');

        const os = require('os').platform();

        console.log('Hi');
        console.log(`App version: ${data.app.getVersion()}`);
        console.log(`Platform: ${os}`);

        data.self.splashWindow = new SplashWindow();
        data.self.splashWindow.init(data.self.settings, data.app, () => data.self.mainWindow == null, () => {
            console.log('Splash initlfsidf koro4e done');
            this.check_status(data);
        });

        if (process.platform === 'win32') {
            const queryValue = ['HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', data.self.settings.appName];
            queryValue.unshift('query');
            const test_auto_start = spawn(data.self.settings.regExe, queryValue);
            let stdout = '';
            test_auto_start.stdout.on('data', (data) => {
                stdout += data;
            });
            test_auto_start.on('close', (code, signal) => {
                const doesOldKeyExist = stdout.indexOf(data.self.settings.appName) >= 0;
                data.self.local_settings.set('app_launch_with_the_system', doesOldKeyExist);
            });
        }

        data.app.whenReady().then(() => {
            //Трей
            let tray = new Tray(process.platform === 'win32' ? path.join(__dirname, '..', 'favicon-194x194.ico') : path.join(__dirname, '..', 'linux_256.png'));
            const contextMenu = Menu.buildFromTemplate([
                {
                    label: 'Show App',
                    click: () => {
                        if (data.self.mainWindow) data.self.mainWindow.show();
                    }
                },
                {
                    label: 'Settings',
                    submenu: [
                        {
                            label: 'Поверх всех окон',
                            sublabel: 'Приложение будет всегда впереди',
                            type: 'checkbox',
                            checked: data.self.local_settings.get('app_always_on_top'),
                            click: (e) => {
                                if (data.self.mainWindow) {
                                    data.self.mainWindow.webContents.send("fromMain", {
                                        type: 'change_setting',
                                        setting: 'app_always_on_top',
                                        value: e.checked
                                    });
                                    data.self.local_settings.set('app_always_on_top', e.checked);
                                    data.self.mainWindow.setAlwaysOnTop(e.checked);
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
                                        data.self.local_data.set('app_position', {
                                            type: 'default',
                                            bounds: data.self.local_data.get('app_position').bounds
                                        });
                                    }
                                },
                                {
                                    label: 'Текущая',
                                    sublabel: 'Запомнить текущую позицию и размеры',
                                    click: () => {
                                        data.self.local_data.set('app_position', {
                                            type: 'custom',
                                            bounds: data.self.mainWindow.getBounds()
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
                        if (data.self.useElectronUpdater) {
                            newAutoUpdater.checkForUpdatesAndNotify();
                        } else {
                            autoUpdater.checkForUpdates();
                        }
                    }
                },
                {
                    label: 'Close ' + require('./../package.json').version,
                    click: () => {
                        console.log('close')
                        if (data.self.splashWindow) data.self.splashWindow.end();
                        if (data.self.mainWindow) data.self.mainWindow.close();
                        if (data.self.autoupdater_interval !== null) clearInterval(data.self.autoupdater_interval);
                        if (data.self.wallpaper !== null && data.self.wallpaper.active) data.self.wallpaper.end();
                    }
                }
            ]);
            tray.setToolTip('ServOKio');
            tray.setContextMenu(contextMenu);
            tray.on('click', () => {
                if (data.self.mainWindow) data.self.mainWindow.show();
            });
            console.log(tray.isDestroyed())

            console.log('Register protocol')
            protocol.interceptFileProtocol('file', (scheme, callback) => {
                const url = scheme.url.substr(8);
                if (url) {
                    callback({ url: path.normalize(`${__dirname}/${url}`) })
                } else {
                    console.error('Failed to register protocol');
                }
            });
        });
    }

    check_status(data) {
        function isJson(str) { try { JSON.parse(str); } catch (e) { return false; } return true; }
        const getter = data.self.settings.servokio_stats_url.startsWith('https') ? require('https') : require('http');
        console.log(`Stats from ${data.self.settings.servokio_stats_url}`);
        getter.get(data.self.settings.servokio_stats_url, (res) => {
            const { statusCode } = res;
            if (statusCode !== 200) {
                console.error("Error getting update information");
                console.log(`A new attempt to get information will be made via: ${data.self.settings.retry_after_error}ms`);
                setTimeout(() => {
                    this.check_status();
                }, data.self.settings.retry_after_error);
            } else {
                res.setEncoding('utf8');
                let rawData = '';
                res.on('data', (chunk) => { rawData += chunk });
                res.on('end', () => {
                    if (isJson(rawData)) {
                        const stats = JSON.parse(rawData);
                        if (!data.self.develop.enable) {
                            if (data.self.useElectronUpdater) {
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
                    } else {
                        console.error("The server returned an invalid response.")
                    }
                });
            }
        }).on('error', (err) => {
            console.error("Error: " + err);
            console.log(`A new attempt to get information will be made via: ${settings.retry_after_error}ms`);
            setTimeout(() => {
                data.self.check_status();
            }, data.self.settings.retry_after_error);
        })
    }

    setupAutoUpdaterEvents(data) {
        //Check

        if (data.self.useElectronUpdater) {
            console.log(`Update channel: ${newAutoUpdater.channel}`);
        } else {
            console.log(`Update url: ${autoUpdater.getFeedURL()}`);
        }

        setTimeout(() => {
            if (data.self.useElectronUpdater) {
                newAutoUpdater.checkForUpdatesAndNotify();
            } else {
                autoUpdater.checkForUpdates();
            }
        }, 10 * 1000);

        data.self.autoupdater_interval = setInterval(() => {
            if (data.self.useElectronUpdater) {
                newAutoUpdater.checkForUpdatesAndNotify();
            } else {
                autoUpdater.checkForUpdates();
            }
        }, 10 * 1000 * 60);

        if (data.self.useElectronUpdater) {
            newAutoUpdater.on('error', (error) => {
                console.error(`Error on update: ${error.message}`);
                if (data.self.mainWindow !== null) data.self.mainWindow.webContents.send("fromMain", { type: 'update_updater_status_lol', status: 'error' });
                console.error(error);
            });

            newAutoUpdater.on('checking-for-update', () => {
                console.log(`Check for updates`);
                if (data.self.mainWindow !== null) data.self.mainWindow.webContents.send("fromMain", { type: 'update_updater_status_lol', status: 'checking' });
            });

            newAutoUpdater.on('update-available', () => {
                console.log(`An update is available`);
                if (data.self.mainWindow !== null) data.self.mainWindow.webContents.send("fromMain", { type: 'update_updater_status_lol', status: 'available' });
            });

            newAutoUpdater.on('update-not-available', () => {
                console.log(`No updates found`);
                if (data.self.mainWindow !== null) data.self.mainWindow.webContents.send("fromMain", { type: 'update_updater_status_lol', status: 'not_available' });
            });

            newAutoUpdater.on('update-downloaded', (event, releaseNotes, releaseName, releaseDate, updateURL) => {
                console.log(`New update: ${releaseDate}`);
                if (data.self.mainWindow !== null) data.self.mainWindow.webContents.send("fromMain", { type: 'update_updater_status_lol', status: 'downloaded' });
            });

            newAutoUpdater.on('before-quit-for-update', () => {
                console.log(`bgau`);
            });
        } else {
            autoUpdater.on('error', (error) => {
                console.error(`Error on update: ${error.message}`);
                if (data.self.mainWindow !== null) data.self.mainWindow.webContents.send("fromMain", { type: 'update_updater_status_lol', status: 'error' });
                console.error(error);
            });

            autoUpdater.on('checking-for-update', () => {
                console.log(`Check for updates`);
                if (data.self.mainWindow !== null) data.self.mainWindow.webContents.send("fromMain", { type: 'update_updater_status_lol', status: 'checking' });
            });

            autoUpdater.on('update-available', () => {
                console.log(`An update is available`);
                if (data.self.mainWindow !== null) data.self.mainWindow.webContents.send("fromMain", { type: 'update_updater_status_lol', status: 'available' });
            });

            autoUpdater.on('update-not-available', () => {
                console.log(`No updates found`);
                if (data.self.mainWindow !== null) data.self.mainWindow.webContents.send("fromMain", { type: 'update_updater_status_lol', status: 'not_available' });
            });

            autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName, releaseDate, updateURL) => {
                console.log(`New update: ${releaseDate}`);
                if (data.self.mainWindow !== null) data.self.mainWindow.webContents.send("fromMain", { type: 'update_updater_status_lol', status: 'downloaded' });
            });

            autoUpdater.on('before-quit-for-update', () => {
                console.log(`bgau`);
            });
        }
    }

    startMain(data) {
        console.log("Start main");
        data.self.updateSounds();
        if (data.self.mainWindow === null) {
            console.log("Start main null - ok");
            data.self.mainWindow = new BrowserWindow(data.self.settings.main_screen_settings);

            data.self.mainWindow.webContents.once('new-window', (e, windowURL) => {
                console.log(windowURL)
                e.preventDefault();
                shell.openExternal(windowURL);
            });

            data.self.mainWindow.webContents.once('dom-ready', () => {
                console.log('main loaded');
                if (data.self.splashWindow) {
                    setTimeout(() => data.self.splashWindow.nukeWindow(), 100);
                }

                data.self.mainWindow.show();
                data.self.mainWindow.setAlwaysOnTop(data.self.local_settings.get('app_always_on_top'));
                if (data.self.local_data.get('app_position').type === 'custom') data.self.mainWindow.setBounds(data.self.local_data.get('app_position').bounds);
                if (data.self.develop.enable) data.self.mainWindow.webContents.openDevTools();
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
                            checked: data.self.local_settings.get('app_always_on_top'),
                            click: (e) => {
                                if (data.self.mainWindow) {
                                    data.self.mainWindow.webContents.send("fromMain", {
                                        type: 'change_setting',
                                        setting: 'app_always_on_top',
                                        value: e.checked
                                    });
                                    data.self.local_settings.set('app_always_on_top', e.checked);
                                    data.self.mainWindow.setAlwaysOnTop(e.checked);
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
                                        data.self.local_data.set('app_position', {
                                            type: 'default',
                                            bounds: data.self.local_data.get('app_position').bounds
                                        });
                                    }
                                },
                                {
                                    label: 'Текущая',
                                    sublabel: 'Запомнить текущую позицию и размеры',
                                    click: () => {
                                        data.self.local_data.set('app_position', {
                                            type: 'custom',
                                            bounds: data.self.mainWindow.getBounds()
                                        });
                                    }
                                }
                            ]
                        }
                    ]
                },
            ]));

            data.self.mainWindow.loadURL(data.self.develop.enable ? 'http://localhost:3000/app/music/life' : 'https://servokio.ru/app');

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
                        data.self.sounds.sort((a, b) => {
                            return (b.meta.listenings + b.meta.seeked_listenings) - (a.meta.listenings + a.meta.seeked_listenings);
                        });
                        //console.log(data.self.sounds.filter(s => s.meta.listenings > 0))
                        event.returnValue = data.self.sounds;
                        break;
                    case "get_local_images":
                        event.returnValue = images;
                        break;
                    case "close_app":
                        if (data.self.mainWindow) data.self.mainWindow.hide();
                        break;
                    case "music.update.listenings":
                        const listenings = data.self.music_data.get('tracks');
                        if (!listenings[sData.id]) listenings[sData.id] = { listenings: 0 }
                        listenings[sData.id].listenings++;
                        data.self.music_data.set('tracks', listenings);
                        break;
                    case "music.update.seekedListenings":
                        const seekedListenings = data.self.music_data.get('tracks');
                        if (!seekedListenings[sData.id]) seekedListenings[sData.id] = { seeked_listenings: 0 }
                        seekedListenings[sData.id].seeked_listenings++;
                        data.self.music_data.set('tracks', seekedListenings);
                        break;
                    case "music.update.customTitle":
                        const tracks = data.self.music_data.get('tracks');
                        if (!tracks[sData.id]) tracks[sData.id] = { customTitle: '-' }
                        tracks[sData.id].customTitle = sData.title;
                        data.self.music_data.set('tracks', tracks);
                        break;
                    case "maximize_app":
                        if (data.self.mainWindow) {
                            if (MainIsMaximized) {
                                //Тут проблема, похоже когда нет рамки он не видит минимум
                                data.self.mainWindow.unmaximize();
                                MainIsMaximized = false;
                            } else {
                                data.self.mainWindow.maximize();
                                MainIsMaximized = true;
                            }
                        }
                        break;
                    case "roll_up_app":
                        if (data.self.mainWindow) data.self.mainWindow.minimize();
                        break;
                    case "change_setting":
                        if (sData.setting === 'app_always_on_top') {
                            data.self.local_settings.set('app_always_on_top', sData.value);
                            data.self.mainWindow.setAlwaysOnTop(sData.value);
                        } else if (sData.setting === 'app_launch_with_the_system') {
                            if (process.platform === 'win32') {
                                const queryValue = ['HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', data.self.settings.appName];
                                queryValue.unshift('query');
                                const ls = spawn(data.self.settings.regExe, queryValue);
                                let stdout = '';
                                ls.stdout.on('data', (data) => {
                                    stdout += data;
                                });
                                ls.on('close', (code, signal) => {
                                    const doesOldKeyExist = stdout.indexOf(data.self.settings.appName) >= 0;
                                    if (sData.value) { //Установить
                                        if (!doesOldKeyExist) {
                                            const args = ['HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', data.self.settings.appName, '/d', process.execPath]
                                            args.unshift('add');
                                            args.push('/f');
                                            const ls = spawn(data.self.settings.regExe, args);
                                            data.self.local_settings.set('app_launch_with_the_system', true);
                                        }
                                    } else { //Удалить
                                        if (doesOldKeyExist) {
                                            const queryValue = ['HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', data.self.settings.appName, '/f'];
                                            queryValue.unshift('delete');
                                            const ls = spawn(data.self.settings.regExe, queryValue);
                                            data.self.local_settings.set('app_launch_with_the_system', false);
                                        }
                                    }
                                });
                            }
                        } else {
                            console.log(`Change other: ${sData.setting} -> ${sData.value}`)
                            data.self.local_settings.set(sData.setting, sData.value);
                        }
                        break;
                    case "get_local_settings":
                        event.returnValue = {
                            settings: data.self.local_settings.getData(),
                            data: data.self.local_data.getData()
                        }
                        break;
                    case "select_music_folder":
                        if (data.self.mainWindow) dialog.showOpenDialog(data.self.mainWindow, {
                            title: "Выберите папку с музыкой",
                            buttonLabel: "Да, именно она",
                            properties: ['openDirectory']
                        }).then(result => {
                            if (!result.canceled) {
                                //0:03 ночи, поэтому мне лень делать всё нормально
                                let folders = data.self.local_data.get('music_search_in_folders');
                                result.filePaths.forEach(folter => {
                                    if (!folders.includes(folter)) folders.push(folter);
                                });
                                data.self.local_data.set('music_search_in_folders', folders);
                                data.self.mainWindow.webContents.send("fromMain", {
                                    type: 'change_data',
                                    param: 'music_search_in_folders',
                                    value: folders
                                });
                            }
                        }).catch(err => {
                            console.log(err)
                        });
                        break;
                    case "delete_music_folder":
                        let folders = data.self.local_data.get('music_search_in_folders').filter(f => f !== sData.folter);
                        data.self.local_data.set('music_search_in_folders', folders);
                        data.self.mainWindow.webContents.send("fromMain", {
                            type: 'change_data',
                            param: 'music_search_in_folders',
                            value: folders
                        });
                        break;
                    case "new_music_presence":
                        data.self.discord_presence = {
                            details: sData.title + ' - ' + sData.description,
                            state: `Listening to music`,
                            startTimestamp: startTimestamp,
                            largeImageKey: '0001',
                            instance: false,
                        }
                        if (data.self.mainWindow != null) {
                            if (sData.picture) {
                                const icon = sData.picture.startsWith('http') ? nativeImage.createFromDataURL(sData.picture) : nativeImage.createFromDataURL(sData.picture);
                                data.self.mainWindow.setOverlayIcon(icon, sData.title + ' - ' + sData.description);
                            }
                        }
                        break;
                    case "update_app":
                        if (data.self.useElectronUpdater) {
                            newAutoUpdater.quitAndInstall();
                        } else autoUpdater.quitAndInstall();
                    case "select_dynamic_wallpaper":
                        if (data.self.mainWindow && ['original', 'hidden'].includes(sData.obj)) dialog.showOpenDialog(data.self.mainWindow, {
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
                                    let old = data.self.local_data.get('app_device_dynamic_wallpaper');
                                    if (fs.existsSync(old[sData.obj])) fs.unlinkSync(old[sData.obj]);
                                    old[sData.obj] = path_to_save;
                                    data.self.local_data.set('app_device_dynamic_wallpaper', old);
                                    data.self.mainWindow.webContents.send("fromMain", {
                                        type: 'change_data',
                                        param: 'app_device_dynamic_wallpaper',
                                        value: old
                                    });
                                    data.self.wallpaper.updateData(old);
                                    data.self.wallpaper.checkWallpaper();
                                });
                            }
                        }).catch(err => {
                            console.log(err)
                        });
                        break;
                    case "update_data":
                        data.self.local_data.set(sData.param, sData.value);
                        data.self.mainWindow.webContents.send("fromMain", {
                            type: 'change_data',
                            param: sData.param,
                            value: sData.value
                        });
                        break;
                    default:
                        console.log('Шо такое ? Кто это ? Отвали со своим этим самым');
                }
            });

            if (process.platform === 'win32') {
                data.self.mainWindow.on('session-end', () => {
                    data.self.wallpaper.end();
                });
            }
            //this.initMinecraft()
            //mainWindow.maximize();
        }
    }
}

module.exports = Start;