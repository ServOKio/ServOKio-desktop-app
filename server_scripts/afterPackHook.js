const axios = require('axios');

exports.default = async function (context) {
    axios.post('https://discord.com/api/webhooks/733728243571752991/tpQJhhsOyPrUeoSI3C-ae64kSjkP2u_e4utqc1Pew-Bp31k2DUHy0enPNRWcIZ6X8yf3',
        {
            content: 'The end of the packaging',
            username: 'Electron',
            embeds: [
                {
                    title: 'Info',
                    description: `**Targets**: ${context.targets.map(target=>{return target.name}).join(', ')}\n**Platform name**: ${context.electronPlatformName}`,
                    color: 8505220
                }
            ]
        }
    ).then(function (response) {
    }).catch(function (error) {
        console.log(error);
    });
}