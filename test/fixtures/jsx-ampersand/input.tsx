// A bare `&` in a JSX string is a character, not an entity
export function Menu() {
  return (
    <button className="gap-1 [&_svg]:shrink-0 flex items-center [&_svg]:pointer-events-none">
      <p className="text-xl [&:not(:first-child)]:mt-6 leading-7 text-muted-foreground" />
      <i className="mx-auto [&>div]:p-4 aspect-square [&>div]:flex" />
    </button>
  );
}
