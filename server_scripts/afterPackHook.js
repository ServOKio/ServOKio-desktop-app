const axios = require('axios');

exports.default = async function (context) {
    axios.post('https://discord.com/api/webhooks/946853724377198603/7TIV2dvhVsVaaJa0iO-ynyBjmajvBdMPr-ZfZih145UxmgbTDi51ca28Pd9f8ScR7duW',
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