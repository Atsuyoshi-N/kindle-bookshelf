import { getAllBooks } from "@/lib/books";
import { BookShelf } from "./bookshelf";

export default function Home() {
  const books = getAllBooks();

  return <BookShelf books={books} />;
}
