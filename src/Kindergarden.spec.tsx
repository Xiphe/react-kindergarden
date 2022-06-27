import {
  createContext,
  Dispatch,
  memo,
  ReactElement,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import Kindergarden, {
  KindergardenContext,
  SetData,
  useKindergarden,
  useUpdate,
} from './Kindergarden';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

function createRegistry<Data = undefined>() {
  const entries: (Data | null)[] = [];
  return {
    entries,
    onAdd() {
      entries.push(null);
    },
    onUpdate(index: number, entry: Data) {
      entries.splice(index, 1, entry);
    },
    onRemove(index: number) {
      entries.splice(index, 1);
    },
  };
}

describe('Kindergarden', () => {
  it('throws when child is rendered outside of Kindergarden', () => {
    const Child = () => {
      useKindergarden();
      return null;
    };

    expect(() => {
      jest.spyOn(console, 'error').mockImplementationOnce(() => {});
      create(<Child />);
    }).toThrowError('Can not useKindergarden outside of <Kindergarden>');
  });

  it('does not throw when kindergarden is optional', () => {
    const Child = () => {
      useKindergarden({ optional: true });
      return null;
    };

    let root: ReactTestRenderer;
    act(() => {
      expect(() => {
        root = create(<Child />);
      }).not.toThrow();
    });

    act(() => {
      root.unmount();
    });
  });

  it('hold reference to nested child', () => {
    const registry = createRegistry<ReactElement<{}, 'li'>>();
    const Child = () => {
      return <li ref={useKindergarden<HTMLLIElement>()}>Hi</li>;
    };

    let root: ReactTestRenderer;
    act(() => {
      root = create(
        <Kindergarden {...registry}>
          <ul>
            <Child />
          </ul>
        </Kindergarden>,
        {
          createNodeMock: (el) => el,
        },
      );
    });

    expect(registry.entries).toEqual([
      { type: 'li', props: { children: 'Hi' } },
    ]);

    act(() => {
      root.unmount();
    });

    expect(registry.entries).toEqual([]);
  });

  it('holds reference to nested children with data', () => {
    type Data = { ref?: HTMLLIElement | null; text?: string };
    const registry = createRegistry<Data>();
    const Child = ({ children }: { children: string }) => {
      const update = useKindergarden<Data>();
      useEffect(() => {
        update({ ...update.current, text: children });
      }, [update, children]);
      return (
        <li ref={(ref) => update({ ...update.current, ref })}>{children}</li>
      );
    };

    let root: ReactTestRenderer;
    act(() => {
      root = create(
        <Kindergarden {...registry}>
          <ul>
            <Child>Hi</Child>
          </ul>
          <ul>
            <li>
              <ul>
                <Child>Ho</Child>
              </ul>
            </li>
          </ul>
        </Kindergarden>,
        {
          createNodeMock: (el) => el,
        },
      );
    });

    expect(registry.entries).toEqual([
      { ref: { type: 'li', props: { children: 'Hi' } }, text: 'Hi' },
      { ref: { type: 'li', props: { children: 'Ho' } }, text: 'Ho' },
    ]);

    act(() => {
      root.unmount();
    });

    expect(registry.entries).toEqual([]);
  });

  it('uses custom context with typed data', () => {
    type Data = { $el?: HTMLButtonElement | null; cool?: boolean };
    const context = createContext<KindergardenContext<Data> | null>(null);
    const registry = createRegistry<Data>();

    (function tsErrors() {
      let _: any = () => {
        const update = useKindergarden({ context });
        // @ts-expect-error
        return <li ref={($el) => update({ $el })} />;
      };
      _ = () => {
        const update = useKindergarden({ context });
        // @ts-expect-error
        update({ cool: 'yes' });
        return null;
      };
      const wrongDataType = createRegistry<{
        $el?: HTMLButtonElement | null;
        cool?: number;
      }>();
      // @ts-expect-error
      _ = <Kindergarden {...wrongDataType} context={context} />;

      const wrongElementType = createRegistry<{
        $el?: HTMLDivElement | null;
        cool?: number;
      }>();
      // @ts-expect-error
      _ = <Kindergarden {...wrongElementType} context={context} />;
    })();

    let update: SetData<Data> | null = null;
    const Child = ({ children }: { children: string }) => {
      const u = useKindergarden({ context });
      update = update || u;

      return (
        <button ref={($el) => u({ ...u.current, $el })}>{children}</button>
      );
    };
    let root: ReactTestRenderer;
    act(() => {
      root = create(
        <ul>
          <Kindergarden {...registry} context={context}>
            <Child>Hi</Child>
            <Child>Ho</Child>
          </Kindergarden>
        </ul>,
        {
          createNodeMock: (el) => el,
        },
      );
    });

    expect(registry.entries).toEqual([
      {
        $el: { type: 'button', props: { children: 'Hi' } },
      },
      {
        $el: { type: 'button', props: { children: 'Ho' } },
      },
    ]);

    act(() => {
      update!({ ...update!.current, cool: false });
    });

    expect(registry.entries).toEqual([
      {
        $el: { type: 'button', props: { children: 'Hi' } },
        cool: false,
      },
      {
        $el: { type: 'button', props: { children: 'Ho' } },
      },
    ]);

    act(() => {
      root.unmount();
    });

    expect(registry.entries).toEqual([]);
  });

  describe('events', () => {
    it('calls onAdd, onUpdate and onRemove for each child', () => {
      const addCb = jest.fn(() => {});
      const removeCb = jest.fn();
      const updateCb = jest.fn((i, kind) => {
        expect([0, 1]).toContain(i);
        expect(kind).toEqual({
          props: {
            children: i === 0 ? 'Hi' : 'Ho',
          },
          type: 'li',
        });
      });
      const Child = ({ children }: { children: string }) => (
        <li ref={useKindergarden()}>{children}</li>
      );

      let root: ReactTestRenderer;
      act(() => {
        root = create(
          <Kindergarden onAdd={addCb} onRemove={removeCb} onUpdate={updateCb}>
            <ul>
              <Child>Hi</Child>
              <Child>Ho</Child>
            </ul>
          </Kindergarden>,
          {
            createNodeMock: (el) => el,
          },
        );
      });

      expect(addCb).toHaveBeenCalledTimes(2);
      expect(updateCb).toHaveBeenCalledTimes(2);

      expect(removeCb).not.toHaveBeenCalled();

      act(() => {
        root.unmount();
      });

      expect(addCb).toHaveBeenCalledTimes(2);
      expect(updateCb).toHaveBeenCalledTimes(2);
      expect(removeCb).toHaveBeenCalledTimes(2);
    });
  });

  describe('update', () => {
    it('throws used outside of Kindergarden', () => {
      const Child = () => {
        useUpdate([]);
        return null;
      };

      expect(() => {
        jest.spyOn(console, 'error').mockImplementationOnce(() => {});
        create(<Child />);
      }).toThrowError('Can not useUpdate outside of <Kindergarden>');
    });

    it('updates registry order when children are sorted', () => {
      const registry = createRegistry<ReactElement<{}, 'li'>>();
      const Child = memo(({ children }: { children: string }) => (
        <li ref={useKindergarden()}>{children}</li>
      ));
      let setChildren: Dispatch<SetStateAction<string[]>>;
      const Sorter = () => {
        const [texts, sc] = useState<string[]>(['Hi', 'Ho']);
        useUpdate([texts]);
        setChildren = sc;
        return (
          <ul>
            {texts.map((t) => (
              <Child key={t}>{t}</Child>
            ))}
          </ul>
        );
      };

      let root: ReactTestRenderer;
      act(() => {
        root = create(
          <Kindergarden {...registry}>
            <Sorter />
          </Kindergarden>,
          {
            createNodeMock: (el) => el,
          },
        );
      });

      expect(registry.entries).toEqual([
        { type: 'li', props: { children: 'Hi' } },
        { type: 'li', props: { children: 'Ho' } },
      ]);

      act(() => {
        setChildren!(['Ho', 'Hi']);
      });

      expect(root!.toJSON()).toMatchInlineSnapshot(`
          <ul>
            <li>
              Ho
            </li>
            <li>
              Hi
            </li>
          </ul>
        `);

      expect(registry.entries).toEqual([
        { type: 'li', props: { children: 'Ho' } },
        { type: 'li', props: { children: 'Hi' } },
      ]);

      act(() => {
        root.unmount();
      });

      expect(registry.entries).toEqual([]);
    });
  });
});
