const
    path = require("path"),
    fs = require("fs");

class Wallpaper {
    constructor(options = {}) {
        const addon_path = path.join(__dirname, '..', 'addons', 'addon.node');
        console.log(`Wallpaper module path: ${addon_path}`);
        this.addon = require(addon_path);

        this.wallpaper_state = {
            data: options.data ? options.data : {
                original: '',
                hidden: ''
            },
            times: options.times.length > 0 ? options.times : [],
            last_update: 'shhh',
            old_original: '',
            old_hidden: ''
        }
        this.inverval = 60 * 1000 * 5
        this.active = false;
        this.check_interval = null;
    }

    init() {
        if (process.platform === 'win32') {
            console.log('Wallpaper for win32');
            this.checkWallpaper();
            this.check_interval = setInterval(() => {
                this.checkWallpaper();
            }, this.inverval);
        }
    }

    checkWallpaper(){
        if (this.active) {
            let change = 0;
            this.wallpaper_state.times.forEach(time => {
                if (this.check(time.from, time.to, new Date().getHours())) { //Если время попало
                    //no
                    change++;
                } else {
                    //allow
                }
            });
            //Если change > 0

            if (this.wallpaper_state.last_update !== change || this.wallpaper_state.old_original !== this.wallpaper_state.data.original || this.wallpaper_state.old_hidden !== this.wallpaper_state.data.hidden) {
                this.wallpaper_state.last_update = change;
                if (change <= 0) { //Если время не попало ставим оригинальные
                    console.log('Change to original');
                    this.wallpaper_state.old_original = this.wallpaper_state.data.original;
                    this.wallpaper_state.old_hidden = this.wallpaper_state.data.hidden;
                    if (this.wallpaper_state.data.original != null) {
                        if (fs.existsSync(this.wallpaper_state.data.original)) this.addon.changeWallpaper(this.wallpaper_state.data.original);
                    }
                } else {
                    console.log('Change to hide');
                    this.wallpaper_state.old_original = this.wallpaper_state.data.original;
                    this.wallpaper_state.old_hidden = this.wallpaper_state.data.hidden;
                    if (this.wallpaper_state.data.hidden != null) {
                        if (fs.existsSync(this.wallpaper_state.data.hidden)) this.addon.changeWallpaper(this.wallpaper_state.data.hidden);
                    }
                }
            }
        }
    }

    /**
    * Whether to check the Wallpaper
    * @param {boolean} [active=this.active] Active
    */
    setActive(active) {
        this.active = active;
    }

    updateData(data){
        this.wallpaper_state.data = data;
    }

    check(start, end, time) {
        if (end < start) {
            if (time >= start) {
                return true;
            } else {
                if (time <= end) {
                    return true;
                } else {
                    return false;
                }
            }
        } else {
            if (time >= start && time <= end) {
                return true;
            } else {
                return false;
            }
        }
    }

    end() {
        if (this.check_interval !== null) clearInterval(this.check_interval);
        if (this.active && process.platform === 'win32') {
            console.log('Change to hide');
            if (fs.existsSync(this.wallpaper_state.data.hidden)) this.addon.changeWallpaper(this.wallpaper_state.data.hidden);
        }
    }
}

module.exports = Wallpaper;