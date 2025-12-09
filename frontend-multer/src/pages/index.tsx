import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

interface Author {
  username: string;
}

interface Post {
  id: string;
  content: string;
  imagePath?: string;
  createdAt: string;
  updatedAt: string;
  author?: Author;
  replyToId?: string;
  replyTo?: {
    id: string;
    content: string;
    author?: Author;
  };
  replies?: Post[];
}

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, token } = useAuth();

  async function fetchPosts() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("http://localhost:3000/posts");
      if (!response.ok) {
        throw new Error("Failed to fetch posts");
      }
      const data = await response.json();
      setPosts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPosts();
  }, []);

  async function handleDelete(id: string) {
    if (!token) {
      alert("Please login to delete posts");
      return;
    }

    if (confirm("Are you sure?")) {
      try {
        const response = await fetch(`http://localhost:3000/posts/${id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.ok) {
          fetchPosts();
          alert("Deleted successfully.");
        } else if (response.status === 401) {
          alert("Please login to delete posts");
        } else if (response.status === 403) {
          alert("You can only delete your own posts");
        } else {
          alert("Error deleting post");
        }
      } catch (error) {
        alert("Error deleting post");
      }
    }
  }

  function canModifyPost(post: Post): boolean {
    return !!user && !!post.author && post.author.username === user.username;
  }

  return (
    <>
      <h1>App Posts</h1>

      {user ? (
        <a href="/posts/new" className="btn btn-primary mb-3">
          Create New Post
        </a>
      ) : (
        <div className="alert alert-info mb-3">
          <a href="/auth/login">Login</a> to create posts
        </div>
      )}

      {loading ? (
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : error ? (
        <div className="alert alert-danger">
          <h4>Error</h4>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={fetchPosts}>
            Try Again
          </button>
        </div>
      ) : posts.length > 0 ? (
        <div className="row">
          {posts
            .filter((post) => !post.replyToId)
            .map((post) => (
              <div key={post.id} className="mb-3">
                <div className="card">
                  {post.imagePath && (
                    <img
                      src={`${process.env.NEXT_PUBLIC_UPLOAD_URL}/${post.imagePath}`}
                      className="card-img-top"
                      alt="Post image"
                      style={{
                        maxWidth: "100%",
                        maxHeight: "400px",
                        objectFit: "contain",
                      }}
                    />
                  )}
                  <div className="card-body">
                    <p className="card-text">{post.content}</p>
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <small className="text-muted">
                          {new Date(post.createdAt).toLocaleDateString()}
                          {post.author && (
                            <>
                              {" "}
                              by <strong>{post.author.username}</strong>
                            </>
                          )}
                        </small>
                      </div>
                    </div>
                    <div className="mt-2">
                      <a
                        href={`/posts/${post.id}`}
                        className="btn btn-sm btn-info me-2"
                      >
                        View
                      </a>
                      {user && (
                        <a
                          href={`/posts/${post.id}/reply`}
                          className="btn btn-sm btn-success me-2"
                        >
                          Reply
                        </a>
                      )}
                      {canModifyPost(post) && (
                        <>
                          <a
                            href={`/posts/${post.id}/edit`}
                            className="btn btn-sm btn-warning me-2"
                          >
                            Edit
                          </a>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDelete(post.id)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>

                    {post.replies && post.replies.length > 0 && (
                      <div className="mt-3 ms-3 border-start border-3 ps-3">
                        <h6 className="text-muted mb-3">
                          Replies ({post.replies.length}):
                        </h6>
                        {post.replies.map((reply) => (
                          <div
                            key={reply.id}
                            className="mb-2 p-2 bg-light rounded"
                          >
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <strong className="small">
                                {reply.author?.username || "Anonymous"}
                              </strong>
                              <small className="text-muted">
                                {new Date(reply.createdAt).toLocaleDateString()}
                              </small>
                            </div>
                            {reply.imagePath && (
                              <div className="mb-2">
                                <img
                                  src={`${process.env.NEXT_PUBLIC_UPLOAD_URL}/${reply.imagePath}`}
                                  alt="Reply image"
                                  className="img-fluid rounded"
                                  style={{ maxWidth: "100%", maxHeight: "200px", objectFit: "contain" }}
                                />
                              </div>
                            )}
                            <p className="mb-0 small">
                              <a
                                href={`/posts/${reply.id}`}
                                className="text-dark text-decoration-none"
                              >
                                {reply.content}
                              </a>
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="alert alert-info">
          <h4>No posts yet</h4>
          <p>Be the first to create a post!</p>
          <a href="/posts/new" className="btn btn-primary">
            Create First Post
          </a>
        </div>
      )}
    </>
  );
}
