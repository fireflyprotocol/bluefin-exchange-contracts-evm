const params = require("../eventConfig.json");

interface IEventConfig {
    EVENT_MAP: {
        [key in string]: string[];
    };
    FILE_PATH: string;
}

export const EventConfig: IEventConfig = {
    EVENT_MAP: params,
    FILE_PATH: "./deployments/event.json"
};
