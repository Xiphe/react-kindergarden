import type { Context, MutableRefObject, ReactNode } from 'react';
import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export type SetData<Data> = {
  (data: Data): void;
  current: Data | null;
};
export interface KindergardenContext<Data = undefined> {
  (): {
    setData: SetData<Data>;
    unregister(): void;
  };
  update: () => void;
}
export const DefaultKindergardenContext =
  createContext<KindergardenContext<any> | null>(null);

interface KindergardenRegistry<Data = undefined> {
  add(ref: MutableRefObject<Data | null>): void;
  update(ref: MutableRefObject<Data | null>): void;
  remove(ref: MutableRefObject<Data | null>): void;
  hooks: RegistryHooks<Data>;
}
export interface RegistryHooks<Data = undefined> {
  onAdd?(): void;
  onRemove?(index: number): void;
  onUpdate?(index: number, data: Data): void;
}

export interface KindergardenProps<Data = undefined>
  extends RegistryHooks<Data> {
  children?: ReactNode;
  context?: Context<KindergardenContext<Data> | null>;
}
export default function Kindergarden<Data = undefined>({
  context: { Provider } = DefaultKindergardenContext,
  onAdd,
  onRemove,
  onUpdate,
  children,
}: KindergardenProps<Data>) {
  const registry = useMemo((): KindergardenRegistry<Data> => {
    const state: MutableRefObject<Data | null>[] = [];
    const hooks: RegistryHooks<Data> = {};
    return {
      hooks,
      add(data) {
        state.push(data);
        hooks.onAdd?.();
      },
      update(data) {
        if (hooks.onUpdate) {
          const index = state.indexOf(data);
          if (index !== -1) {
            hooks.onUpdate(index, data.current!);
          }
        }
      },
      remove(data) {
        const index = state.indexOf(data);
        if (index !== -1) {
          state.splice(index, 1);
          hooks.onRemove?.(index);
        }
      },
    };
  }, []);
  registry.hooks.onAdd = onAdd;
  registry.hooks.onRemove = onRemove;
  registry.hooks.onUpdate = onUpdate;

  const [triggerUpdate, setTriggerUpdate] = useState<symbol>(Symbol());

  const register = useMemo<KindergardenContext<Data>>(() => {
    const callback: KindergardenContext<Data> = () => {
      const ref: MutableRefObject<Data | null> = { current: null };

      registry.add(ref);

      const setData: SetData<Data> = (data) => {
        ref.current = data;
        setData.current = data;
        registry.update(ref);
      };
      setData.current = null;

      return {
        setData,
        unregister() {
          registry.remove(ref);
        },
      };
    };
    callback.update = () => setTriggerUpdate(Symbol());

    return callback;
  }, [triggerUpdate, registry]);

  return <Provider value={register}>{children}</Provider>;
}

export interface UseUpdateProps {
  context?: Context<KindergardenContext | null>;
  ignoreInitial?: boolean;
}
export function useUpdate(
  dependencies: any[],
  {
    context = DefaultKindergardenContext,
    ignoreInitial = true,
  }: UseUpdateProps = {},
) {
  const register = useContext(context);
  const isInitial = useRef(ignoreInitial);
  if (!register) {
    throw new Error('Can not useUpdate outside of <Kindergarden>');
  }
  useLayoutEffect(() => {
    if (isInitial.current) {
      isInitial.current = false;
      return;
    }
    register.update();
  }, dependencies);
}

export interface UseKindergardenProps<Data = undefined> {
  context?: Context<KindergardenContext<Data> | null>;
  optional?: boolean;
}
export function useKindergarden<Data = undefined>({
  context = DefaultKindergardenContext,
  optional,
}: UseKindergardenProps<Data> = {}): SetData<Data> {
  const register = useContext(context) || noopRegister;

  if (register === noopRegister && !optional) {
    throw new Error('Can not useKindergarden outside of <Kindergarden>');
  }

  const { unregister, setData } = useMemo(() => {
    return register();
  }, [register]);
  useLayoutEffect(() => () => unregister(), [unregister]);

  return setData;
}

const noopRegister = (): any => {
  return {
    /* istanbul ignore next */
    setData() {},
    unregister() {},
  };
};
