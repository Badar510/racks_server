
export class CompartmentDataDto {
    compartment?: string;
}

export class UpdateStateDto {
    compartment?: string;
    Astate1: string;
    Astate2: string;
    Bstate1: string;
    Bstate2: string;
    Cstate1: string;
    Cstate2: string;
    Dstate1: string;
    Dstate2: string;
}

export class WarehouseIdDto {
    warehouseId: string;
}


export class ManualOverRideDto {
    boxstate: string;
    timeout: number;
}
