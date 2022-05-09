const axios = require('axios');

exports.default = async function (context) {
    axios.post('https://discord.com/api/webhooks/946853724377198603/7TIV2dvhVsVaaJa0iO-ynyBjmajvBdMPr-ZfZih145UxmgbTDi51ca28Pd9f8ScR7duW',
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