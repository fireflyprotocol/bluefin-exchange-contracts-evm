import { BigNumber } from "./submodules/library";

export enum OrderStatus {
    Null = 0,
    Canceled = 1
}

export enum GuardianStatus {
    Allowed = 0,
    Disallowed = 1
}

export interface OrderState {
    status: OrderStatus;
    filledAmount: BigNumber;
}
