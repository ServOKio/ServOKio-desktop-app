const
    fs = require("fs"),
    path = require("path"),
    ChildProcess = require('child_process'),
    { app, BrowserWindow, ipcMain, shell, Menu, Tray, protocol, dialog, autoUpdater, remote, nativeImage } = require('electron'),

    //modules
    Store = require('./store.js'),
    Vec3 = require('vec3'),
    Wallpaper = require('./wallpaper.js'),
    Music = require('./music.js'),
    appStart = require('./start.js');

class App {
    /**
    * @param {AppOptions} [options] Options for the app
    */
    constructor(options = {}) {
        this.useElectronUpdater = false;
        this.develop = options.develop ? options.develop : {
            enable: false,
            frame: true,
            titleBarStyle: 'default'
        }
        this.modules = {
            wallpaper: null,
            music: null
        };
        this.local_data = new Store({
            configName: 'data-store',
            defaults: {
                music_search_in_folders: [],
                music_replace_track_image: [],
                app_position: {
                    type: 'default',
                    bounds: null
                },
                app_device_dynamic_wallpaper: {
                    original: null,
                    hidden: null,
                    time: [
                        {
                            from: 7,
                            to: 16
                        }
                    ]
                }
            }
        });

        this.local_settings = new Store({
            configName: 'user-preferences',
            defaults: {
                app_always_on_top: false,
                app_launch_with_the_system: false,
                app_min_width: 600,
                music_replace___to_emply: true,
                music_smooth_attenuation: true,
                music_display_tag_320kbit: true,
                music_find_youtube_tag: false,
                music_hide_ads_from_title: true,
                music_play_next_track_if_current_ended: true,
                music_timeout_before_the_next_track: 1,
                music_eq_type: 0,
                app_device_dynamic_wallpaper: false
            }
        });

        this.sounds = [];

        this.splashWindow = null;
        this.mainWindow = null;

        this.discord_presence = {};

        this.autoupdater_interval = null;
    }

    init() {
        console.log('Initialization...');

        console.log(`+--------------------------------------------------+`);
        console.log(`| Welcome to ServOKio App`);
        console.log(`| Now we will launch the app`);
        console.log(`+--------------------------------------------------+`);

        //Init wallpaper module
        this.modules.wallpaper = new Wallpaper({
            data: this.local_data.get('app_device_dynamic_wallpaper'),
            times: this.local_data.get('app_device_dynamic_wallpaper').time,
            main: this
        });
        this.modules.wallpaper.setActive(this.local_settings.get('app_device_dynamic_wallpaper'));

        //Init music module
        this.modules.music = new Music({main: this});

        //Init start of app
        this.appStart = new appStart({main: this});

        this.settings = {
            request_timeout: 5 * 1000,
            retry_after_error: 10 * 1000,
            splash_screen_settings: {
                width: 480,
                height: 320,
                transparent: false,
                frame: this.develop.enable,
                resizable: this.develop.enable,
                center: true,
                show: false,
                webPreferences: {
                    nodeIntegration: true
                }
            },
            main_screen_settings: {
                width: 800,
                height: 600,
                minWidth: this.local_settings.get('app_min_width'),
                minHeight: 600,
                show: false,
                resizable: true,
                fullscreenable: true,
                defaultFontFamily: 'sansSerif',
                defaultEncoding: 'UTF-8',
                icon: process.platform === 'win32' ? path.join(__dirname, '..', 'favicon-194x194.ico') : path.join(__dirname, '..', 'linux_256.png'),
                webPreferences: {
                    webgl: true,
                    contextIsolation: true,
                    enableRemoteModule: true,
                    preload: path.join(__dirname, './preloader/preload.js'),
                    webSecurity: false
                },
                center: this.local_data.get('app_position').type === 'default',
                title: 'ServOKio | App',
                frame: this.develop.enable && this.develop.frame ? true : false,
                transparent: this.develop.enable ? false : true,
                hasShadow: true,
                titleBarStyle: this.develop.enable ? this.develop.titleBarStyle : 'hidden'
            },
            servokio_stats_url: 'https://servokio.ru/hello',
            appName: path.basename(process.execPath, '.exe'),
            regExe: process.env.SystemRoot ? `${process.env.SystemRoot}\\System32\\reg.exe` : 'reg.exe'
        }

        console.log('Initial settings are ready');
        app.setAboutPanelOptions({
            applicationName: 'ServOKio',
            applicationVersion: require('./../package.json').version,
            authors: ['D.Y.'],
            website: 'servokio.ru'
        });

        app.on('ready', () => {
            this.appStart.start({
                self: this,
                app: app
            });

            //this.initMinecraft();
        });
    }

    /**
    * Setting up auto-update for the app. Squirrel windows or nsis
    * @example
    * setupAutoUpdater();
    */
    setupAutoUpdater() {
        if (process.platform === 'win32' && !this.develop.enable) { //Если windows и не режим разраба
            if (fs.existsSync(path.resolve(path.dirname(process.execPath), '..', 'Update.exe'))) { //Если squirrel
                console.log(`Update.exe found`);
                if (require('electron-squirrel-startup')) return;
                if (this.handleSquirrelEvent()) {
                    // squirrel event handled and app will exit in 1000ms, so don't do anything else
                    return false;
                }
            } else {
                console.log(`Update.exe not found`);
                this.useElectronUpdater = true;
            }
        } else this.useElectronUpdater = true;
        return true;
    }

    handleSquirrelEvent() {
        if (process.argv.length === 1) {
            return false;
        }

        const appFolder = path.resolve(process.execPath, '..');
        const rootAtomFolder = path.resolve(appFolder, '..');
        const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));
        const exeName = path.basename(process.execPath);

        const spawn = (command, args) => {
            let spawnedProcess, error;

            try {
                spawnedProcess = ChildProcess.spawn(command, args, { detached: true });
            } catch (error) {

            }

            return spawnedProcess;
        }

        const spawnUpdate = (args) => {
            return spawn(updateDotExe, args);
        }

        const squirrelEvent = process.argv[1];
        switch (squirrelEvent) {
            case '--squirrel-install':
            case '--squirrel-updated':
                spawnUpdate(['--createShortcut', exeName]);
                setTimeout(app.quit, 1000);
                return true;
            case '--squirrel-uninstall':
                spawnUpdate(['--removeShortcut', exeName]);
                setTimeout(app.quit, 1000);
                return true;
            case '--squirrel-obsolete':
                app.quit();
                return true;
        }
    }

    initMinecraft() {
        let online_players = new Set();
        if (this.develop.enable) {
            console.log('start mineflayer')
            const mineflayer = require('mineflayer');
            let bot = mineflayer.createBot({
                host: "my.servokio.ru",
                port: 25565,
                username: "Some_Player",
                version: "1.12.2"
            });
            bot.on('chat', function (username, message) {
                if (this.mainWindow) this.mainWindow.webContents.send("fromMinecraft", ["chat_event", { username: username, message: message }]);
            });

            bot.on('message', (message) => {
                //console.log(bot.tablist)
                if (this.mainWindow) this.mainWindow.webContents.send("fromMinecraft", ["server_message", { message: message }]);
            });

            bot.on("playerJoined", (player) => {
                online_players.add(player.username);
                if (this.mainWindow) setTimeout(() => {
                    let players = [];
                    online_players.forEach(nick => {
                        players.push(bot.players[nick]);
                    });
                    this.mainWindow.webContents.send("fromMinecraft", ["update_online", players]);
                }, 100)
            })
            bot.on("playerLeft", (player) => {
                online_players.delete(player.username);
                if (this.mainWindow) setTimeout(() => {
                    let players = [];
                    online_players.forEach(nick => {
                        players.push(bot.players[nick]);
                    });
                    this.mainWindow.webContents.send("fromMinecraft", ["update_online", players]);
                }, 0)
            });

            let p_fix = {
                x: 0,
                y: 0,
                z: 0
            };
            bot.on('move', () => {
                // socket.emit('entity', bot.entity);
                if (p_fix.x !== bot.entity.position.x || p_fix.y !== bot.entity.position.y || p_fix.z !== bot.entity.position.z) {
                    p_fix.x = bot.entity.position.x;
                    p_fix.y = bot.entity.position.y;
                    p_fix.z = bot.entity.position.z;
                    if (this.mainWindow) this.mainWindow.webContents.send("fromMinecraft", ["move", { location: bot.entity.position }]);
                }
            });

            bot.on("login", () => {
                console.log(bot.players)
            })

            bot.on('error', err => console.log(err));

            ipcMain.on("toMinecraft", (event, args) => {
                if (this.develop.enable) {
                    if (args[0] === "send_message") {
                        bot.chat(args[1]);
                        event.returnValue = bot ? true : false;
                    } else if (args[0] === "get_server") {
                        let players = [];
                        online_players.forEach(nick => {
                            players.push(bot.players[nick]);
                        });

                        const start = bot.entity.position;
                        const chunk_conf = {
                            x: 16,
                            y: 256,
                            z: 16
                        }

                        let levels = [];
                        for (let y = 0; y < chunk_conf.y; ++y) {
                            let level_z = [];
                            for (let z = 0; z < chunk_conf.z; ++z) {
                                //Проходимся по x
                                let x_level = [];
                                for (let x = 0; x < chunk_conf.x; ++x) {
                                    const block = bot.blockAt(start.offset(x, -start.y + y, z));
                                    if (!block) {
                                        x_level[x] = {
                                            valid: false
                                        }
                                    } else x_level[x] = {
                                        valid: true,
                                        type: block.type,
                                        metadata: block.metadata
                                    }
                                }
                                //Наполнили х
                                level_z[z] = x_level;
                            }
                            levels[y] = level_z;
                        }

                        event.returnValue = {
                            inventory: bot.inventory,
                            online: players,
                            chunk: levels
                        }
                    } else if (args[0] === "set_сontrol_state") {
                        console.log(`${args[1]} ${args[2]}`)
                        if (bot) bot.setControlState(args[1], args[2]);
                        event.returnValue = true;
                    } else if (args[0] === "set_quick_bar_slot") {
                        if (bot) bot.setQuickBarSlot(args[1]);
                        event.returnValue = true;
                    } else if (args[0] === "get_chunk") {
                        //Получаем чанк
                        //const bl = bot.entity.position;
                        const chunk_start_x = parseInt((args[1].x / 16).toFixed(0));
                        const chunk_start_z = parseInt((args[1].z / 16).toFixed(0));

                        const start = bot.entity.position;
                        const chunk_conf = {
                            x: 16,
                            y: 256,
                            z: 16
                        }

                        let levels = [];
                        for (let y = 0; y < chunk_conf.y; ++y) {
                            let level_z = [];
                            for (let z = 0; z < chunk_conf.z; ++z) {
                                //Проходимся по x
                                let x_level = [];
                                for (let x = 0; x < chunk_conf.x; ++x) {
                                    const block = bot.blockAt(new Vec3((chunk_start_x * 16) + x, y, (chunk_start_z * 16) + z));
                                    if (!block) {
                                        x_level[x] = {
                                            valid: false
                                        }
                                    } else x_level[x] = {
                                        valid: true,
                                        type: block.type,
                                        metadata: block.metadata
                                    }
                                }
                                //Наполнили х
                                level_z[z] = x_level;
                            }
                            levels[y] = level_z;
                        }

                        const final = {
                            chunk_real: {
                                x: chunk_start_x,
                                z: chunk_start_z,
                            },
                            levels: levels
                        }
                        if (this.mainWindow) this.mainWindow.webContents.send("fromMinecraft", ["update_chunk", final]);
                    } else if (args[0] === "camera_move") {
                        console.log(args)
                        if (bot) bot.look(args[2], args[1]);
                        event.returnValue = true;
                    }
                }
            });
        }
    }
}

module.exports = App;