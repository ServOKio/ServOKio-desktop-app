const { BrowserWindow, Menu } = require('electron');

class SplashWindow {

    constructor(options = {}) {
        this.splashWindow = null;
    }

    init(settings, app, mainWindow, callback) {
        console.log('Init splash screen...');

        //Окно загрузки и обновления
        // Основной проблемой было придумать что можно показать пользователю на экране загрузки. Это должны были быть два варианта:
        // 1. Быстрая загрузка. Она длится около 2-5 секуд поэтому использовать какие-то анимации было просто невозможно
        // 2. Если нет соединения. Стандартное время около 10 секунд, но может длиться неограниченное кол-во времени так что появилась задача придумать что может быть дейсвительно интересным и одновременно простым
        //
        // 2.1 В первом варианте была идея показывать анимацию где показывается кол-во различных файлов например музыки, картинок, видео и т.д. , но оно просто скучное.
        // 2.2 Второй вариант - это загрузка на фоне какой-то информации по типу интересных картинок, статьи и другое, но есть вариат просто не успеть дочитать если соединение вдруг появится, а оставлять экран загрузки открытым нельзя.
        // 2.3 Третий - теги со страницы 404 которые просто можно посмотреть, но это будет выглядеть просто странно.
        // 2.4 Четвёртый - какой-то экран с фоном и текстом по типу "Доброй ночи, User. Пятница, Февраль 16", но это скорее подойдёт для стартового экрана в приложении

        this.splashWindow = new BrowserWindow(settings.splash_screen_settings);
        this.splashWindow.webContents.on('will-navigate', e => e.preventDefault());

        this.splashWindow.webContents.once('dom-ready', () => {
            this.splashWindow.show();

            //Меню
            const isMac = process.platform === 'darwin';
            const template = [
                {
                    label: 'Приложение',
                    submenu: [
                        isMac ? { role: 'close' } : { role: 'quit' },
                        { role: 'reload' },
                        { role: 'forcereload' },
                        { role: 'toggledevtools' },
                        { type: 'separator' },
                        { role: 'resetzoom' },
                        { role: 'zoomin' },
                        { role: 'zoomout' },
                        { type: 'separator' },
                        { role: 'togglefullscreen' }
                    ]
                },
                {
                    label: 'Окно',
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
                    label: 'Помощь',
                    role: 'help',
                    submenu: [
                        {
                            label: 'Learn More',
                            click: () => {
                                shell.openExternal('https://electronjs.org')
                            }
                        }
                    ]
                }
            ];
            const menu = Menu.buildFromTemplate(template)
            Menu.setApplicationMenu(menu);
            callback();
        });

        this.splashWindow.on('closed', () => {
            this.splashWindow = null;
            if (mainWindow()) {
                app.quit();
            }
        });

        this.splashWindow.loadFile('./modules/preloader/index.html');
    }

    nukeWindow() {
        this.splashWindow.hide();
        this.splashWindow.close();
        this.splashWindow = null;
    }

    end(){
        if(this.splashWindow) this.splashWindow.close();
    }
}

module.exports = SplashWindow;