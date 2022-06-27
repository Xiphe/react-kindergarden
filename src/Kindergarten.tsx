import type { Context, MutableRefObject, ReactNode } from 'react';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export type SetData<Data> = {
  (data: Data): void;
  current: Data | null;
};
export interface KindergartenContext<Data = undefined> {
  (): {
    setData: SetData<Data>;
    unregister(): void;
  };
  update: () => void;
}
export const DefaultKindergartenContext =
  createContext<KindergartenContext<any> | null>(null);

interface KindergartenRegistry<Data = undefined> {
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

export interface KindergartenProps<Data = undefined>
  extends RegistryHooks<Data> {
  children?: ReactNode;
  context?: Context<KindergartenContext<Data> | null>;
}
export default function Kindergarten<Data = undefined>({
  context: { Provider } = DefaultKindergartenContext,
  onAdd,
  onRemove,
  onUpdate,
  children,
}: KindergartenProps<Data>) {
  const registry = useMemo((): KindergartenRegistry<Data> => {
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

  const register = useMemo<KindergartenContext<Data>>(() => {
    const callback: KindergartenContext<Data> = () => {
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
  context?: Context<KindergartenContext | null>;
  ignoreInitial?: boolean;
}
export function useUpdate(
  dependencies: any[],
  {
    context = DefaultKindergartenContext,
    ignoreInitial = true,
  }: UseUpdateProps = {},
) {
  const register = useContext(context);
  const isInitial = useRef(ignoreInitial);
  if (!register) {
    throw new Error('Can not useUpdate outside of <Kindergarten>');
  }
  useEffect(() => {
    if (isInitial.current) {
      isInitial.current = false;
      return;
    }
    register.update();
  }, dependencies);
}

export interface UseKindergartenProps<Data = undefined> {
  context?: Context<KindergartenContext<Data> | null>;
  optional?: boolean;
}
export function useKindergarten<Data = undefined>({
  context = DefaultKindergartenContext,
  optional,
}: UseKindergartenProps<Data> = {}): SetData<Data> {
  const register = useContext(context) || noopRegister;

  if (register === noopRegister && !optional) {
    throw new Error('Can not useKindergarten outside of <Kindergarten>');
  }

  const { unregister, setData } = useMemo(() => {
    return register();
  }, [register]);
  useEffect(() => () => unregister(), [unregister]);

  return setData;
}

const noopRegister = (): any => {
  return {
    /* istanbul ignore next */
    setData() {},
    unregister() {},
  };
};
