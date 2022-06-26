import {
  Context,
  createContext,
  MutableRefObject,
  ReactNode,
  RefCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';

export interface Kind<ElementType extends HTMLElement, Data = undefined> {
  $el: ElementType | null;
  data?: Data;
}

export interface KindergardenContext<ElementType extends HTMLElement, Data> {
  (data?: Data): {
    updateData(data?: Data): void;
    ref: RefCallback<ElementType>;
    unregister(): void;
  };
}

const DefaultKindergardenContext = createContext<KindergardenContext<
  HTMLElement,
  any
> | null>(null);

interface KindergardenProps<ElementType extends HTMLElement, Data> {
  registry: MutableRefObject<Kind<ElementType, Data>[]>;
  onRegister?: (entry: Kind<ElementType, Data>) => void;
  children?: ReactNode;
  context?: Context<KindergardenContext<ElementType, Data> | null>;
}

export default function Kindergarden<ElementType extends HTMLElement, Data>({
  registry,
  context = DefaultKindergardenContext,
  onRegister,
  children,
}: KindergardenProps<ElementType, Data>) {
  const { Provider } = context;
  const onRegisterRef = useRef(onRegister);
  onRegisterRef.current = onRegister;

  const register = useMemo<KindergardenContext<ElementType, Data>>(() => {
    const callback: KindergardenContext<ElementType, Data> = (data) => {
      const entry: Kind<ElementType, Data> = {
        $el: null,
        data,
      };

      registry.current.push(entry);
      onRegisterRef.current?.(entry);

      return {
        updateData(data) {
          entry.data = data;
        },
        ref(element) {
          entry.$el = element;
        },
        unregister() {
          registry.current.splice(registry.current.indexOf(entry), 1);
        },
      };
    };

    return callback;
  }, []);

  return <Provider value={register}>{children}</Provider>;
}

interface UseKindergardenProps<ElementType extends HTMLElement, Data> {
  data?: Data;
  context?: Context<KindergardenContext<ElementType, Data> | null>;
  optional?: boolean;
}
export function useKindergarden<ElementType extends HTMLElement, Data>({
  data,
  context = DefaultKindergardenContext,
  optional,
}: UseKindergardenProps<ElementType, Data> = {}):
  | RefCallback<ElementType>
  | undefined {
  const register = useContext(context);

  if (!register) {
    if (!optional) {
      throw new Error(
        'Can not useKindergarden outside of Kindergarden context',
      );
    }
    return;
  }

  const { ref, unregister, updateData } = useMemo(
    () => register(data),
    [register],
  );
  useEffect(() => {
    updateData(data);
  }, [updateData, data]);
  useEffect(() => () => unregister(), [unregister]);
  return ref;
}
