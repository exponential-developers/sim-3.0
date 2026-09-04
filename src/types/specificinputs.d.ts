type SpecificInputNumberValidation = {
    type: "int" | "float" | "exp",
    min: number | string,
    max: number | string
}

type SpecificInputValidationType = SpecificInputNumberValidation | {
    type: "string"
}

type SpecificInputTextbox = {
    label: string,
    type: "textbox",
    validation: SpecificInputValidationType,
    placeholder?: string
}

type SpecificInputSlider = {
    label: string,
    type: "slider",
    validation: SpecificInputNumberValidation,
    step: number,
    default?: number
}

type SpecificInputDropdown = {
    label: string,
    type: "dropdown",
    choices: string[]
}

type SpecificInputType = SpecificInputTextbox | SpecificInputSlider | SpecificInputDropdown;

type StratSpecificInputRecord<T extends theoryType, S extends stratType[T]> 
    = Partial<Record<StratSpecificInputOf[T][S], string>>;
    
type GeneralStratSpecificInputRecord<T extends theoryType, S extends FullStratType<T>> 
    = S extends stratCategoryType ? {} : S extends stratType[T] ? StratSpecificInputRecord<T, S> : never;

type SpecificInputRecord<theory extends theoryType> = Partial<Record<SpecificInputOf[theory], string>>;

type SpecificInputFullRecord = {[theory in theoryType]: SpecificInputRecord<theory>};