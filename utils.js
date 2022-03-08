const constants = require('./constants');
const config = require('./config');

function chunkArray(array, limit, res = []) {
  if (!limit) throw new Error('No chunk size defined');
  if (array.length === 0) return res;
  return chunkArray(array.slice(limit, array.length), limit, [
    ...res,
    array.slice(0, limit),
  ]);
}

function escapeRegExp(str) {
  // eslint-disable-next-line no-useless-escape
  return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
}

function replaceAll(str, find, replace) {
  return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

function cleanDoubleQuotes(text) {
  return replaceAll(replaceAll(text, '\u201D', '"'), '\u201C', '"');
}

function reducePollOptionsString(items, emojis) {
  return items.options.reduce(
    (text, option, index) => `${text}:${emojis[index]}: ${option} \n\n`,
    ''
  );
}

function extractElementsFromSlackText(text) {
  const mode =
    text.search('-s') >= 0
      ? constants.pollMode.SINGLE
      : constants.pollMode.MULTIPLE;
  const expIndex = text.search('-exp');
  // console.log('expINdex: ', expIndex);
  let exptime = null
  if (expIndex >= 0) {
    let i = expIndex + 6;
    exptime = "";
    while (i< text.length) {
      exptime += text[i];
      i++;
      if (text[i] == '"') break;
    }
    exptime = new Date(exptime)
    text = text.slice(0, expIndex) + text.slice(i + 1);
  }
  const rawOptions = text
    .replace('-s', '')
    .split('"')
    .map(s => s.trim())
    .filter(s => s !== '' && s !== ' ');

  return {
    mode,
    exptime,
    question: rawOptions[0],
    options: rawOptions.slice(1),
  };
}

function extractPollData(rawSlaskCommandString) {
  const sanitizeText = cleanDoubleQuotes(rawSlaskCommandString);
  const pollElements = extractElementsFromSlackText(sanitizeText);
  const emojis =
    pollElements.options.length > 10
      ? constants.emojis
      : constants.fallbackEmojis;

  const title = `${pollElements.question}\n\n`;
  const optionsString = reducePollOptionsString(pollElements, emojis);
  // console.log('pollData: ', { emojis, title, optionsString, ...pollElements })
  return { emojis, title, optionsString, ...pollElements };
}

 const aa = extractPollData(`"What do you like?" "Orange" "Grapefruit" -exp="2020-12-12 23:00"`);

// Enhance polloptions with user answers
function reducePollEnhancedOptionsString(items, currentPollAnswers, emojis) {
  return items.options.reduce((text, option, index) => {
    const answerValue = `${option}-${index}`;
    const allUserAnswers = currentPollAnswers.filter(
      cpa => cpa.answer === answerValue
    );

    const usernamesString = allUserAnswers.reduce(
      (baseText, user) => `${baseText} <@${user.userId}>`,
      ''
    );

    const counterString =
      allUserAnswers.length !== 0 ? `: \`${allUserAnswers.length}\`` : '';

    return `${text}:${
      emojis[index]
    }: ${option}${counterString} ${usernamesString} \n\n `;
  }, '');
}

function stringFromPollMode(pollModeId) {
  return pollModeId === constants.pollMode.MULTIPLE ? 'Multiple' : 'Single';
}

// Base message template from https://api.slack.com/docs/message-formatting
function buildMessageTemplate(pollAssets) {
  let footer;
  if (pollAssets.expiretime) {
    footer = `By: <@${pollAssets.owner}>, Mode: ${stringFromPollMode(
      pollAssets.mode
    )}, Time: ${pollAssets.expiretime}`;
  } else {
    footer = `By: <@${pollAssets.owner}>, Mode: ${stringFromPollMode(
      pollAssets.mode
    )}`;
  }
  return {
    attachments: [
      {
        fallback: pollAssets.title,
        title: pollAssets.title,
        callback_id: pollAssets.id,
        color: config.SLACK_MESSAGE_BAR_COLOR,
        attachment_type: 'default',
        footer,
      },
      {
        fallback: pollAssets.optionsString,
        text: pollAssets.optionsString,
        callback_id: pollAssets.id,
        color: config.SLACK_MESSAGE_BAR_COLOR,
        attachment_type: 'default',
      },
      ...chunkArray(pollAssets.options, 5).map((chunk, chunkIndex) => ({
        fallback: '',
        title: '',
        callback_id: pollAssets.id,
        color: config.SLACK_MESSAGE_BAR_COLOR,
        attachment_type: 'default',
        actions: chunk.map((option, index) => {
          const currentIndex = chunkIndex * 5 + index;
          return {
            name: `${option}-${currentIndex}`,
            text: `:${pollAssets.emojis[currentIndex]}:`,
            type: 'button',
            value: `${option}-${currentIndex}`,
          };
        }),
      })),
      {
        fallback: '',
        title: '',
        callback_id: pollAssets.id,
        color: config.SLACK_MESSAGE_BAR_COLOR,
        attachment_type: 'default',
        actions: [
          {
            name: 'cancel',
            text: 'Delete Poll',
            style: 'danger',
            type: 'button',
            value: 'cancel-null',
            confirm: {
              title: 'Delete Poll?',
              text: 'Are you sure you want to delete the Poll?',
              ok_text: 'Yes',
              dismiss_text: 'No',
            },
          },
        ],
      },
    ],
  };
}

// Base on https://api.slack.com/docs/message-formatting
// Replace the ampersand, &, with &amp;
// Replace the less-than sign, < with &lt;
// Replace the greater-than sign, > with &gt;
function parseEscapeCharacters(actionValue) {
  let result = actionValue.replace(/&amp;/g, '&');
  result = result.replace(/&lt;/g, '<');
  result = result.replace(/&gt;/g, '>');
  return result;
}

module.exports = {
  chunkArray,
  replaceAll,
  cleanDoubleQuotes,
  extractPollData,
  extractElementsFromSlackText,
  reducePollOptionsString,
  reducePollEnhancedOptionsString,
  stringFromPollMode,
  buildMessageTemplate,
  parseEscapeCharacters,
};
