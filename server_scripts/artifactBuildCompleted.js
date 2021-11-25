const axios = require('axios');

exports.default = async function (context) {
    axios.post('https://discord.com/api/webhooks/733728243571752991/tpQJhhsOyPrUeoSI3C-ae64kSjkP2u_e4utqc1Pew-Bp31k2DUHy0enPNRWcIZ6X8yf3',
        {
            content: 'End build',
            username: 'Electron',
            embeds: [
                {
                    title: 'Done',
                    description: `**Target**: ${context.target.name}\n**msi**: ${context.target.options.msi ? '🟢' : '🔴'}`,
                    color: 8505220,
                    fields: [
                        {
                            name: 'Platform',
                            value: `**Name**: ${context.packager.platform.name}\n**nodeName**: ${context.packager.platform.nodeName}`,
                            inline: true
                        },
                        {
                            name: 'App info',
                            value: `**Description**: \`${context.packager.appInfo.description}\`\n**Version**: ${context.packager.appInfo.version}`,
                            inline: true
                        }
                    ]
                }
            ]
        }
    ).then(function (response) {
    }).catch(function (error) {
        console.log(error);
    });
}