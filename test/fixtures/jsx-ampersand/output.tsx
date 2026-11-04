// A bare `&` in a JSX string is a character, not an entity
export function Menu() {
  return (
    <button className="flex items-center gap-1 [&_svg]:pointer-events-none [&_svg]:shrink-0">
      <p className="text-muted-foreground text-xl leading-7 [&:not(:first-child)]:mt-6" />
      <i className="mx-auto aspect-square [&>div]:flex [&>div]:p-4" />
    </button>
  );
}
